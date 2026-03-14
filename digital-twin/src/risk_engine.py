import asyncio
from datetime import datetime, timezone
import functools
import networkx as nx
from src.db_client import get_project_data, save_risk_alerts, supabase
from src.services import get_llm_completion, get_velocity_metrics
from src.jira_auth import get_valid_token as get_jira_token
from src.jira_client import get_accessible_resources, get_active_issues
from src.notion_auth import get_valid_notion_token
from src.notion_client import get_active_tasks as get_notion_tasks

async def analyze_grouped_conflict_with_llm(target_name, sources, user_config):
    """
    Analyzes the interaction between multiple recently modified units and a single legacy code unit.
    Determines if the recent changes might break assumptions in the legacy code, or if this legacy code is becoming a risky bottleneck.
    """
    system_prompt = (
        "You are a Senior Software Architect specializing in legacy modernization. "
        "Analyze the interaction where MULTIPLE RECENTLY MODIFIED functions depend on a SINGLE LEGACY function (unchanged for months). "
        "Predict if the recent changes might break assumptions in the legacy code, or if this legacy code is becoming a risky bottleneck. "
        "Be concise. Focus on data flow, responsibilities, and architecture assumptions."
    )
    
    user_prompt = f"--- LEGACY CODE (Target: {target_name}) ---\n\n"
    user_prompt += f"--- RECENT CODE (Touching the legacy unit) ---\n"
    
    # Only pass the full summary for the top 3 most recently modified units to save tokens
    for i, s in enumerate(sources[:3]):
        user_prompt += f"\nActive Unit {i+1}: {s['source_key']}\n"
    
    # If there are more than 3 units, just list their names
    if len(sources) > 3:
        other_names = [s['source_key'] for s in sources[3:]]
        user_prompt += f"\n...and {len(sources) - 3} other active units ({', '.join(other_names)}).\n"
        
    user_prompt += "\nTASK: Explain the potential combined risk in 2-3 sentences. If the risk is generic, say 'Standard dependency risk'."
    
    # Wrap synchronous LLM call to run in a separate thread
    loop = asyncio.get_running_loop()
    func = functools.partial(get_llm_completion, system_prompt, user_prompt, user_config=user_config)
    analysis= await loop.run_in_executor(None, func)
    return analysis if analysis else "Standard dependency risk detected."


async def calculate_predictive_risks(project_id, user_config):
    print(f"🚀 Starting Advanced Predictive Risk Analysis for {project_id}...")
    
    # 1. Fetch Project Metadata for API calls
    proj_res = supabase.table("projects").select("repo_url").eq("id", project_id).limit(1).execute()
    
    # Safely get the first item from the list, then get the repo_url
    repo_url = ""
    if proj_res and proj_res.data and len(proj_res.data) > 0:
        repo_url = proj_res.data[0].get("repo_url", "")
    
    # Normalize repo name (owner/repo)
    repo_name = repo_url.split("github.com/")[-1].replace(".git", "") if "github.com" in repo_url else ""

    # 2. CLEAR PREVIOUS PREDICTIVE RISKS
    supabase.table("project_risks").delete().eq("project_id", project_id).in_("risk_type", ["Legacy Conflict", "Predictive Delay", "Knowledge Silo"]).execute()

    risks = []
    # 3. FETCH GRAPH DATA & MAP UNITS
    units, edges = get_project_data(project_id)
    if not units: return 0

    now = datetime.now(timezone.utc)
    unit_map = {u['unit_name']: u for u in units if u.get('last_modified_at')}
    for u_name, u in unit_map.items():
        last_mod = datetime.fromisoformat(u['last_modified_at'].replace('Z', '+00:00'))
        u['age_days'] = (now - last_mod).days

    # 4. BUILD GRAPH (Existing Logic)
    G = nx.DiGraph()
    
    import_map = {}
    for edge in edges:
        if edge.get('edge_type') == 'imports' or '::' not in edge['target_unit_name']:
            src_file = edge['source_unit_name'].split('::')[0]
            if src_file not in import_map: import_map[src_file] = []
            import_map[src_file].append(edge['target_unit_name'])

    for edge in edges:
        source_id = edge['source_unit_name']
        target_short_name = edge['target_unit_name']
        
        if source_id not in unit_map: continue

        potential_targets = [k for k in unit_map.keys() if k.endswith(f"::{target_short_name}")]
        
        for target_id in potential_targets:
            src_file = source_id.split('::')[0]
            tgt_file = target_id.split('::')[0]
            
            target_mod_path = tgt_file.replace('\\', '.').replace('/', '.').replace('.py', '')
            
            file_imports = import_map.get(src_file, [])
            if src_file == tgt_file or any(imp in target_mod_path for imp in file_imports):
                G.add_edge(source_id, target_id)

    # 5. IDENTIFY LEGACY CONFLICTS & KNOWLEDGE SILOS
    active_units = [k for k, v in unit_map.items() if v['age_days'] < 30]
    legacy_units = [k for k, v in unit_map.items() if v['age_days'] > 90]

    # 6. VELOCITY DETECTION
    proj_res = supabase.table("projects").select("repo_url, jira_project_id, notion_project_id, user_id").eq("id", project_id).limit(1).execute()
    
    if proj_res and proj_res.data and len(proj_res.data) > 0:
        proj_data = proj_res.data[0]
        repo_url = proj_data.get("repo_url", "")
        jira_project_id = proj_data.get("jira_project_id")
        notion_project_id = proj_data.get("notion_project_id")
        project_user_id = proj_data.get("user_id")
        
        repo_name = repo_url.split("github.com/")[-1].replace(".git", "") if "github.com" in repo_url else ""

        if repo_name:
            velocity_change = get_velocity_metrics(repo_name)
            recent_churn_count = len([u for u in active_units if unit_map[u]['age_days'] < 7])
            
            # fetch unresolved tasks from Jira or Notion
            unresolved_tasks_count = None
            
            if project_user_id:
                if jira_project_id:
                    j_token = get_jira_token(project_user_id)
                    if j_token:
                        resources = get_accessible_resources(j_token)
                        if resources:
                            issues = get_active_issues(resources[0]["id"], j_token)
                            if issues is not None:
                                unresolved_tasks_count = len(issues)
                
                if unresolved_tasks_count is None and notion_project_id:
                    n_token = get_valid_notion_token(project_user_id)
                    if n_token:
                        tasks = get_notion_tasks(notion_project_id, n_token)
                        if tasks is not None:
                            unresolved_tasks_count = len(tasks)

            delay_risk = heuristic_delay_detector(
                velocity_change=velocity_change, 
                unresolved_tasks_count=unresolved_tasks_count, 
                high_churn_files=recent_churn_count
            )
            
            if delay_risk:
                risks.append({
                    "project_id": project_id,
                    "risk_type": delay_risk["risk_type"],
                    "severity": delay_risk["severity"],
                    "description": delay_risk["description"],
                    "affected_units": ["Project Timeline"]
                })

    grouped_conflicts = {}
    for source in active_units:
        if source not in G: continue
        for target in legacy_units:
            if target not in G or source == target: continue
            if nx.has_path(G, source, target):
                path = nx.shortest_path(G, source, target)
                if 1 < len(path) <= 4:
                    if target not in grouped_conflicts: grouped_conflicts[target] = []
                    grouped_conflicts[target].append({"source_key": source, "source_unit": unit_map[source], "path": path})

    # 7. RUN LLM ANALYSIS
    llm_coroutines = []
    conflict_details = []

    for target, sources in grouped_conflicts.items():
        coro = analyze_grouped_conflict_with_llm(target, unit_map[target], sources, user_config)
        llm_coroutines.append(coro)
        conflict_details.append({"target_key": target, "target_age": unit_map[target]['age_days'], "sources": sources})

    if llm_coroutines:
        analyses = await asyncio.gather(*llm_coroutines)
        for i, analysis_result in enumerate(analyses):
            det = conflict_details[i]
            risks.append({
                "project_id": project_id,
                "risk_type": "Legacy Conflict",
                "severity": "High" if len(det['sources']) >= 3 else "Medium", 
                "description": f"\n\n**Function:** `{det['target_key']}`\n\n**Age:** {det['target_age']} days is hit by {len(det['sources'])} new changes. \n\n**Lumis Analysis:** {analysis_result}",
                "affected_units": [det['target_key']] + [s['source_key'] for s in det['sources']]
            })

    # 8. SAVE RESULTS
    save_risk_alerts(project_id, risks)
    return len(risks)

def heuristic_delay_detector(velocity_change: float, unresolved_tasks_count: int = None, high_churn_files: int = 0):
    """
    Pure mathematical calculation of project delays. Zero AI tokens used.
    """
    # If they are working fast or normal, there is no delay risk.
    if velocity_change >= -0.10: 
        return None 
        
    # Scenario A: We have task data (Jira/Notion)
    if unresolved_tasks_count is not None:
        if unresolved_tasks_count == 0:
            return None # Project is done, velocity drop is normal!
        if velocity_change < -0.40 and unresolved_tasks_count > 10:
            return {
                "risk_type": "Predictive Delay",
                "severity": "High",
                "description": f"Development speed dropped by {abs(velocity_change)*100:.0f}%, but there are still {unresolved_tasks_count} pending tasks. The team is likely blocked."
            }

    # Scenario B: We only have GitHub Data
    else:
        if velocity_change < -0.30 and high_churn_files >= 2:
            return {
                "risk_type": "Predictive Delay",
                "severity": "Medium",
                "description": f"Velocity dropped by {abs(velocity_change)*100:.0f}%, and developers are repeatedly editing the same {high_churn_files} files. This indicates they are stuck debugging a complex issue."
            }
            
    return None
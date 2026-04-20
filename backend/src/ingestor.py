import os
import shutil
import git
import stat
import logging
from git.exc import InvalidGitRepositoryError
from datetime import datetime, timezone
from src.services import embed_model, generate_footprint
from src.db_client import supabase, save_memory_units, save_edges, get_unit_footprint
from src.parser import AdvancedCodeParser

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LumisAPI")

def remove_readonly(func, path, _):
    """Helper to remove read-only restrictions during rmtree on Windows."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass

def get_file_blame_metadata(repo_path, file_path, repo_obj):
    """Runs git blame ONCE per file and maps each line to its last author and commit time."""
    rel_path = os.path.relpath(file_path, repo_path)
    line_metadata = {}
    
    try:
        blame = repo_obj.blame('HEAD', rel_path)
        current_line = 1
        
        for commit, lines in blame:
            dt = commit.committed_datetime
            email = commit.author.email
            for _ in lines:
                line_metadata[current_line] = (dt, email)
                current_line += 1
                
        return line_metadata
    except Exception as e:
        print(f"Blame failed for {rel_path}: {e}")
        return {}

async def ingest_repo(repo_url, project_id, progress_callback=None, user_config=None):
    repo_path = os.path.abspath(f"./temp_repos/{project_id}")
    repo = None
    
    # Extract token from config
    github_token = (user_config or {}).get("github_token")
    
    # Generate Authenticated URL for private repos
    auth_url = repo_url
    if github_token and "github.com" in repo_url and repo_url.startswith("https://"):
        # Format: https://x-access-token:TOKEN@github.com/owner/repo.git
        auth_url = repo_url.replace("https://github.com", f"https://x-access-token:{github_token}@github.com")

    try:
        if progress_callback: progress_callback("CLONING", f"Cloning repository...")
        
        if os.path.exists(repo_path):
            try:
                repo = git.Repo(repo_path)
                # Update remote URL in case token changed or was added
                if github_token:
                    repo.git.remote('set-url', 'origin', auth_url)
                repo.remotes.origin.pull()
            except (InvalidGitRepositoryError, Exception):
                if repo:
                    repo.close()
                shutil.rmtree(repo_path, onerror=remove_readonly)
                repo = git.Repo.clone_from(auth_url, repo_path)
        else:
            os.makedirs(os.path.dirname(repo_path), exist_ok=True)
            repo = git.Repo.clone_from(auth_url, repo_path)

        latest_sha = repo.head.object.hexsha
        supabase.table("projects").update({"last_commit": latest_sha}).eq("id", project_id).execute()
        if progress_callback: progress_callback("METADATA", f"Tracking commit: {latest_sha[:7]}")
        
        parser = AdvancedCodeParser()
        current_scan_identifiers = []
        
        # In-memory batch queues
        blocks_to_embed = []
        edges_to_insert = []

        for root, _, files in os.walk(repo_path):
            if '.git' in root: continue
            
            for file in files:
                file_path = os.path.join(root, file)
                if not parser.filter_process(file_path): continue

                rel_path = os.path.relpath(file_path, repo_path)
                blocks = parser.parse_file(file_path)
                if not blocks: continue
                
                # Fetch blame metadata ONCE for the entire file
                file_blame_meta = get_file_blame_metadata(repo_path, file_path, repo)
                
                for block in blocks:
                    parent = block.parent_block if block.parent_block else 'root'
                    clean_id = f"{rel_path}::{parent}::{block.name}"
                    
                    # 1. DIFFERENTIAL SYNC CHECK
                    current_hash = generate_footprint(block.content)
                    existing_hash = get_unit_footprint(project_id, clean_id)
                    
                    if existing_hash == current_hash:
                        current_scan_identifiers.append(clean_id)
                        continue 

                    # 2. FAST IN-MEMORY PROCESSING (Hold data instead of embedding immediately)
                    if progress_callback: progress_callback("PROCESSING", f"Parsing {block.name}...")
                    
                    s_line = max(1, block.start_line + 1)
                    last_mod, author = file_blame_meta.get(s_line, (datetime.now(timezone.utc), "unknown"))

                    blocks_to_embed.append({
                        "identifier": clean_id,
                        "type": block.type,
                        "file_path": rel_path,
                        "content": block.content,
                        "name": block.name,
                        "footprint": current_hash,
                        "last_mod": last_mod.isoformat() if last_mod else None,
                        "author": author
                    })
                    current_scan_identifiers.append(clean_id)

                    # 3. COLLECT EDGES FOR BULK INSERT
                    if block.calls: 
                        edges_to_insert.extend([{"project_id": project_id, "source_unit_name": clean_id, "target_unit_name": t, "edge_type": "calls"} for t in block.calls])
                    
                    # --- FIXED: Insert edges for modules AND specific imported functions ---
                    if block.imports: 
                        for i in block.imports:
                            # 1. Add edge for the module itself ONLY if it exists
                            if i.module: 
                                edges_to_insert.append({
                                    "project_id": project_id, 
                                    "source_unit_name": clean_id, 
                                    "target_unit_name": i.module, 
                                    "edge_type": "imports"
                                })
                            # 2. Add edges for specific imported names (e.g., calculate_tax_and_fees)
                            for name in i.names:
                                if name and name != "*":
                                    edges_to_insert.append({
                                        "project_id": project_id, 
                                        "source_unit_name": clean_id, 
                                        "target_unit_name": name, 
                                        "edge_type": "imports"
                                    })
                                    
                    if block.bases: 
                        edges_to_insert.extend([{"project_id": project_id, "source_unit_name": clean_id, "target_unit_name": b, "edge_type": "inherits"} for b in block.bases])

        # PHASE 1.5: AUTO-GENERATE REPOSITORY OVERVIEW
        if progress_callback: progress_callback("SYNTHESIS", "Analyzing repository structure to generate overview...")
        try:
            file_paths = []
            manifest_contents = []
            has_readme = False
            
            for b in blocks_to_embed:
                file_paths.append(b["file_path"])
                fname = b["name"].lower()
                if fname == "readme.md":
                    has_readme = True
                if fname in ['package.json', 'pyproject.toml', 'requirements.txt', 'cargo.toml', 'go.mod', 'docker-compose.yml']:
                    manifest_contents.append(f"--- {b['name']} ---\n{b['content'][:2000]}") # Cap length to protect token limits
                    
            if not has_readme:
                from src.services import get_llm_completion
                
                # Truncate tree to avoid blowing up context window
                tree_str = "\n".join(list(set(file_paths))[:300])
                manifests_str = "\n".join(manifest_contents)
                
                sys_prompt = (
                    "You are an elite Software Architect. The user has ingested a codebase that lacks a README file. "
                    "Analyze the provided directory structure and manifest files (dependencies, configs). "
                    "Write a highly technical, concise 2-paragraph overview explaining what this repository is, its primary purpose, and its tech stack. "
                    "Respond ONLY with the technical overview. No greetings or filler."
                )
                usr_prompt = f"DIRECTORY STRUCTURE:\n{tree_str}\n\nMANIFESTS:\n{manifests_str}"
                
                overview_text = get_llm_completion(sys_prompt, usr_prompt, user_config=user_config)
                
                if overview_text and len(overview_text) > 20:
                    overview_id = f"auto_generated::root::project_overview.md"
                    blocks_to_embed.append({
                        "identifier": overview_id,
                        "type": "module",
                        "file_path": "Project_Overview.md",
                        "content": f"# Auto-Generated Project Overview\n\n{overview_text}",
                        "name": "Project_Overview.md",
                        "footprint": generate_footprint(overview_text),
                        "last_mod": datetime.now(timezone.utc).isoformat(),
                        "author": "Lumis AI"
                    })
                    current_scan_identifiers.append(overview_id)
                    logger.info("Successfully generated and injected Auto-Overview.")
        except Exception as e:
            logger.warning(f"Failed to generate auto-overview: {e}")

        # PHASE 2: TEMPORAL GRAPH (GIT HISTORY)
        if progress_callback: progress_callback("HISTORY", "Ingesting Git History and Mapping Commits...")
        
        try:
            # Fetch the last 100 commits to build our history graph
            recent_commits = list(repo.iter_commits('HEAD', max_count=100))
            
            for commit in recent_commits:
                commit_id = f"commit::{commit.hexsha}"
                commit_msg = commit.message.strip()
                author_email = commit.author.email
                
                # Figure out which files this commit modified
                modified_files = []
                if commit.parents:
                    diffs = commit.parents[0].diff(commit)
                    modified_files = [d.b_path for d in diffs if d.b_path]
                else:
                    modified_files = list(commit.stats.files.keys())
                
                # Create a searchable content block for the LLM
                content = (
                    f"Commit SHA: {commit.hexsha}\n"
                    f"Author: {author_email}\n"
                    f"Date: {commit.committed_datetime.isoformat()}\n"
                    f"Message: {commit_msg}\n"
                    f"Files Touched: {', '.join(modified_files)}"
                )
                
                blocks_to_embed.append({
                    "identifier": commit_id,
                    "type": "commit",
                    "file_path": "Git History",
                    "content": content,
                    "name": commit.hexsha[:7],
                    "footprint": generate_footprint(content),
                    "last_mod": commit.committed_datetime.isoformat(),
                    "author": author_email
                })
                
                # Track this commit as part of the current graph to prevent deletion
                current_scan_identifiers.append(commit_id)

                # Draw the Graph Edges! (Commit -> modified -> File)
                for m_file in modified_files:
                    # We link the commit to the root file unit
                    target_file_id = f"{m_file}::root::file"
                    
                    edges_to_insert.append({
                        "project_id": project_id,
                        "source_unit_name": commit_id,
                        "target_unit_name": target_file_id,
                        "edge_type": "modified"
                    })
        except Exception as e:
            logger.warning(f"Could not ingest full git history: {e}")

        # 1. Deduplicate memory units by their unique identifier
        unique_blocks = {}
        for b in blocks_to_embed:
            unique_blocks[b["identifier"]] = b
        blocks_to_embed = list(unique_blocks.values())

        # 2. Deduplicate graph edges to prevent duplicate relations
        unique_edges_set = set()
        deduped_edges = []
        for e in edges_to_insert:
            e_tuple = (e["source_unit_name"], e["target_unit_name"], e["edge_type"])
            if e_tuple not in unique_edges_set:
                unique_edges_set.add(e_tuple)
                deduped_edges.append(e)
        edges_to_insert = deduped_edges

        # --- OPTIMIZATION: BATCH EMBEDDING ---
        if progress_callback: progress_callback("EMBEDDING", "Generating Vector Embeddings in Bulk...")
        
        units_to_insert = []
        if blocks_to_embed:
            # Extract all contents into a single list
            all_contents = [b["content"] for b in blocks_to_embed]
            
            # Fire ONE call to embed everything at once directly via the model
            bulk_embeddings = embed_model.encode(all_contents).tolist()
            
            # Re-associate embeddings with their metadata
            for i, b in enumerate(blocks_to_embed):
                units_to_insert.append({
                    "identifier": b["identifier"],
                    "type": b["type"],
                    "file_path": b["file_path"],
                    "content": b["content"],
                    "footprint": b["footprint"],
                    "embedding": bulk_embeddings[i], # Attach batched embedding
                    "last_modified_at": b["last_mod"],
                    "author_email": b["author"]
                })

        # --- NETWORK EXECUTION ---
        if progress_callback: progress_callback("DATABASE", "Bulk inserting vectors to Supabase...")
        
        # Batch insert chunks of 100
        batch_size = 100
        for i in range(0, len(units_to_insert), batch_size):
            save_memory_units(project_id, units_to_insert[i:i + batch_size])
            
        for i in range(0, len(edges_to_insert), batch_size):
            save_edges(project_id, edges_to_insert[i:i + batch_size])

        # 4. CLEANUP ORPHANS
        if progress_callback: progress_callback("CLEANUP", "Removing deleted files...")
        db_units = supabase.table("memory_units").select("unit_name").eq("project_id", project_id).execute()
        db_unit_names = {u['unit_name'] for u in db_units.data}
        
        orphans = list(db_unit_names - set(current_scan_identifiers))
        
        if orphans:
            print(f"🗑️ Deleting {len(orphans)} orphaned units...")
            supabase.table("graph_edges").delete().eq("project_id", project_id).in_("source_unit_name", orphans).execute()
            supabase.table("memory_units").delete().eq("project_id", project_id).in_("unit_name", orphans).execute()

        # --- NEW: CALCULATE RISKS & SEND SLACK ALERT ---
        if progress_callback: progress_callback("ANALYZING", "Running AI Risk Engine...")
        try:
            # 1. Run the engine so fresh risks are generated and saved to DB
            calculate_predictive_risks(project_id, user_config)
            
            # 2. Fire the Slack alert! (It will fetch the new risks and only send if High/Critical)
            from src.slack_client import send_slack_risk_alert
            send_slack_risk_alert(project_id, repo_url)
        except Exception as risk_err:
            logger.error(f"Risk Engine or Slack Alert failed: {risk_err}")

        # Finish
        if progress_callback: progress_callback("DONE", "Fast Sync Complete. Ready for Analysis.")
        
    except Exception as e:
        logger.error(f"CRITICAL ERROR IN INGESTION: {e}", exc_info=True)
        if progress_callback: progress_callback("Error", str(e))
        raise e
    finally:
        try:
            if repo:
                repo.close()
                
            if os.path.exists(repo_path):
                shutil.rmtree(repo_path, onerror=remove_readonly)
                logging.info(f"Cleaned up local repo at {repo_path}")
        except Exception as cleanup_err:
            print(f"Cleanup failed for {repo_path}: {cleanup_err}")
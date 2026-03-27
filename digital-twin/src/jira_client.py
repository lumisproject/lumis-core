import urllib.parse
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from src.config import Config
import logging

logger = logging.getLogger("LumisAPI")

# --- RATE LIMITING & RETRY STRATEGY ---
jira_session = requests.Session()
retry_strategy = Retry(
    total=5,  
    backoff_factor=2,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS", "TRACE"]
)
adapter = HTTPAdapter(max_retries=retry_strategy)
jira_session.mount("https://", adapter)
jira_session.mount("http://", adapter)

def jira_headers(access_token: str):
    return {"Authorization": f"Bearer {access_token}", "Accept": "application/json", "Content-Type": "application/json"}

def get_accessible_resources(access_token: str):
    url = f"{Config.JIRA_API_BASE}/oauth/token/accessible-resources"
    response = jira_session.get(url, headers={"Authorization": f"Bearer {access_token}"})
    response.raise_for_status()
    return response.json()

def get_issue_details(cloud_id: str, issue_key: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}?fields=summary,description,status"
    response = jira_session.get(url, headers=jira_headers(access_token))
    response.raise_for_status()
    return response.json()

def add_comment(cloud_id: str, issue_key: str, comment: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}/comment"
    payload = {"body": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": comment}]}]}}
    jira_session.post(url, headers=jira_headers(access_token), json=payload).raise_for_status()

def transition_issue(cloud_id: str, issue_key: str, access_token: str, depth=0, target="review"):
    """Smart Transition: Aims for 'review' if complete, or 'progress' if partial."""
    if depth > 3: 
        logger.warning(f"🛑 Max transition depth reached for {issue_key}.")
        return

    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}/transitions"
    headers = jira_headers(access_token)
    
    response = jira_session.get(url, headers=headers)
    if response.status_code != 200:
        return

    transitions = response.json().get("transitions", [])
    if not transitions:
        return
        
    review_transition = None
    progress_transition = None
    done_transition = None
    
    for t in transitions:
        dest_name = t["to"]["name"].lower()
        cat_key = t.get("to", {}).get("statusCategory", {}).get("key", "")
        
        # FIXED THE 'PR' BUG! Replaced "pr" with "pull request"
        if any(kw in dest_name for kw in ["review", "qa", "test", "pull request", "merge", "validate", "check"]):
            review_transition = t
        elif cat_key == "done":
            done_transition = t
        elif cat_key == "indeterminate" or "progress" in dest_name:
            progress_transition = t

    # 🎯 IF THE USER JUST WANTS IT IN PROGRESS (For Partial/Issues)
    if target == "progress":
        if progress_transition:
            payload = {"transition": {"id": progress_transition["id"]}}
            res = jira_session.post(url, headers=headers, json=payload)
            if res.status_code == 204:
                logger.info(f"🎯 Moved {issue_key} to In Progress")
        return

    # 🎯 IF THE USER WANTS IT IN REVIEW (For Complete)
    if review_transition:
        payload = {"transition": {"id": review_transition["id"]}}
        res = jira_session.post(url, headers=headers, json=payload)
        if res.status_code == 204:
            logger.info(f"🎯 SUCCESS! Force-moved {issue_key} to '{review_transition['to']['name']}'")
        return
        
    # Step into In Progress to unlock Review
    if progress_transition:
        logger.info(f"👟 Stepping {issue_key} through '{progress_transition['to']['name']}' to try and unlock Review...")
        payload = {"transition": {"id": progress_transition["id"]}}
        res = jira_session.post(url, headers=headers, json=payload)
        if res.status_code == 204:
            import time
            time.sleep(2.0)
            transition_issue(cloud_id, issue_key, access_token, depth + 1, target="review")
        return

    # Fallback to Done
    if done_transition:
        payload = {"transition": {"id": done_transition["id"]}}
        jira_session.post(url, headers=headers, json=payload)
        
    # X-RAY LOG: This will print EXACTLY what columns Jira is allowing us to move to
    available_destinations = [t['to']['name'] for t in transitions]
    logger.info(f"🚦 PATHWAYS OPEN FOR {issue_key}: {available_destinations}")
        
    review_transition = None
    progress_transition = None
    done_transition = None
    
    for t in transitions:
        dest_name = t["to"]["name"].lower()
        cat_key = t.get("to", {}).get("statusCategory", {}).get("key", "")
        
        # Priority 1: Review/QA Target
        if any(kw in dest_name for kw in ["review", "qa", "test", "pr", "merge", "validate", "check"]):
            review_transition = t
        # Priority 2: Done Target
        elif cat_key == "done":
            done_transition = t
        # Priority 3: Stepping Stone (In Progress)
        elif cat_key == "indeterminate" or "progress" in dest_name:
            # Prevent stepping into In Progress if it's already in progress
            progress_transition = t

    # EXECUTE MOVES
    if review_transition:
        payload = {"transition": {"id": review_transition["id"]}}
        res = jira_session.post(url, headers=headers, json=payload)
        if res.status_code == 204:
            logger.info(f"🎯 SUCCESS! Force-moved {issue_key} to '{review_transition['to']['name']}'")
        return
        
    if progress_transition:
        logger.info(f"👟 Stepping {issue_key} through '{progress_transition['to']['name']}' to try and unlock Review...")
        payload = {"transition": {"id": progress_transition["id"]}}
        res = jira_session.post(url, headers=headers, json=payload)
        if res.status_code == 204:
            time.sleep(2.0) # WAIT 2 SECONDS FOR JIRA'S DATABASE TO SYNC
            transition_issue(cloud_id, issue_key, access_token, depth + 1)
        return

    if done_transition:
        payload = {"transition": {"id": done_transition["id"]}}
        res = jira_session.post(url, headers=headers, json=payload)
        if res.status_code == 204:
            logger.info(f"✅ Moved {issue_key} to '{done_transition['to']['name']}' (No Review column was available)")
        return

def create_issue(cloud_id: str, project_key: str, summary: str, description: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue"
    payload = {
        "fields": {
            "project": {"key": project_key}, "summary": summary,
            "description": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]},
            "issuetype": {"name": "Task"}
        }
    }
    res = jira_session.post(url, headers=jira_headers(access_token), json=payload)
    res.raise_for_status()
    return res.json()  # Returns the new ticket info so we can transition it

# --- RESTORED ORIGINAL FUNCTION ---
def get_projects(cloud_id: str, access_token: str):
    """Fetches the projects to find the Project Key when the board has no active tasks."""
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/project"
    response = jira_session.get(url, headers=jira_headers(access_token))
    if response.status_code == 200:
        return response.json()
    return []

def get_active_issues(cloud_id: str, access_token: str, project_key: str = None):
    """Strictly fetches tickets that are NOT Done to save LLM tokens."""
    
    jql = f'project="{project_key}" AND statusCategory != Done ORDER BY updated DESC' if project_key else 'statusCategory != Done ORDER BY updated DESC'
    encoded_jql = urllib.parse.quote(jql)
    
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/search/jql?jql={encoded_jql}&maxResults=100&fields=summary,description,status"
    headers = jira_headers(access_token)

    try:
        response = jira_session.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Jira API Error {response.status_code}: {response.text}")
            return []
            
        issues = response.json().get("issues", [])
        logger.info(f"API fetched {len(issues)} active tickets (To Do / In Progress).")
        return issues
    except Exception as e:
        logger.error(f"Search API Error: {e}")
        return []


def adf_to_markdown(adf_node):
    """Recursively converts Jira's Atlassian Document Format (ADF) to standard Markdown."""
    if not adf_node or not isinstance(adf_node, dict): return ""
    text = ""
    node_type = adf_node.get("type")
    
    if node_type == "text":
        text = adf_node.get("text", "")
        for mark in adf_node.get("marks", []):
            if mark["type"] == "strong": text = f"**{text}**"
            elif mark["type"] == "em": text = f"*{text}*"
            elif mark["type"] == "code": text = f"`{text}`"
            elif mark["type"] == "link": text = f"[{text}]({mark.get('attrs', {}).get('href', '')})"
    elif node_type == "paragraph":
        text = "".join(adf_to_markdown(c) for c in adf_node.get("content", [])) + "\n\n"
    elif node_type == "bulletList":
        for c in adf_node.get("content", []): text += f"* {adf_to_markdown(c)}"
    elif node_type == "orderedList":
        for i, c in enumerate(adf_node.get("content", []), 1): text += f"{i}. {adf_to_markdown(c)}"
    elif node_type == "listItem":
        text = "".join(adf_to_markdown(c) for c in adf_node.get("content", []))
    elif node_type == "heading":
        level = adf_node.get("attrs", {}).get("level", 1)
        text = f"{'#' * level} " + "".join(adf_to_markdown(c) for c in adf_node.get("content", [])) + "\n\n"
    elif node_type == "codeBlock":
        lang = adf_node.get("attrs", {}).get("language", "")
        code = "".join(adf_to_markdown(c) for c in adf_node.get("content", []))
        text = f"```{lang}\n{code}\n```\n\n"
    elif node_type == "doc":
        text = "".join(adf_to_markdown(c) for c in adf_node.get("content", []))
        
    return text

def get_project_statuses(cloud_id: str, project_key: str, access_token: str):
    """Fetches all valid statuses for a project to generate dynamic Kanban columns, sorted logically."""
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/project/{project_key}/statuses"
    res = jira_session.get(url, headers=jira_headers(access_token))
    res.raise_for_status()
    
    columns_data = []
    seen = set()
    
    # Jira returns statuses grouped by Issue Type. We flatten this.
    for issue_type in res.json():
        for status in issue_type.get("statuses", []):
            s_id = status["id"]
            if s_id not in seen:
                seen.add(s_id)
                category = status.get("statusCategory", {})
                cat_color = category.get("colorName", "neutral")
                cat_key = category.get("key", "new") # Jira categories: 'new', 'indeterminate', 'done'
                
                # Map Jira colors to our Tailwind column colors
                bg_color = "bg-slate-500"
                if cat_color == "blue": bg_color = "bg-blue-500"
                elif cat_color == "green": bg_color = "bg-emerald-500"
                elif cat_color == "yellow": bg_color = "bg-amber-500"

                columns_data.append({
                    "id": s_id,
                    "title": status["name"],
                    "color": bg_color,
                    "category_key": cat_key
                })
                
    # --- NEW SMART SORTING LOGIC ---
    def sort_columns(col):
        # Base category weights: To Do (100) -> In Progress (200) -> Done (300)
        base_weight = {"new": 100, "indeterminate": 200, "done": 300}.get(col["category_key"], 400)
        
        title_lower = col["title"].lower()
        sub_weight = 50 # Default middle placement for unknown columns
        
        # Sub-sort specifically for the blue 'indeterminate' columns
        if col["category_key"] == "indeterminate":
            if any(kw in title_lower for kw in ["progress", "doing", "active", "dev", "build"]):
                sub_weight = 10  # Pull to the left
            elif any(kw in title_lower for kw in ["review", "qa", "test", "pr", "merge", "validate"]):
                sub_weight = 90  # Push to the right
                
        return base_weight + sub_weight

    # Execute the sort
    columns_data.sort(key=sort_columns)
    
    # Clean up the temporary sort key before returning to the frontend
    for col in columns_data:
        col.pop("category_key", None)
        
    return columns_data

def get_board_issues(cloud_id: str, project_key: str, access_token: str):
    """Fetches all tickets and formats them for the frontend Kanban board."""
    
    # FIX: Updated endpoint from /search to /search/jql per Atlassian's recent API deprecation
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/search/jql"
    
    payload = {
        "jql": f"project = {project_key} ORDER BY Rank ASC",
        "maxResults": 100,
        "fields": ["summary", "description", "status", "priority", "assignee", "comment"]
    }
    
    res = jira_session.post(url, headers=jira_headers(access_token), json=payload)
    res.raise_for_status()
    
    tickets = []
    for issue in res.json().get("issues", []):
        fields = issue.get("fields", {})
        
        # Parse Assignee
        assignee = fields.get("assignee")
        assignee_data = {
            "name": assignee["displayName"] if assignee else "Unassigned",
            "avatar": assignee["avatarUrls"]["48x48"] if assignee else "https://api.dicebear.com/7.x/avataaars/svg?seed=Unassigned"
        }
        
        # Parse Comments
        comments = []
        raw_comments = fields.get("comment", {}).get("comments", [])
        for c in raw_comments:
            text = adf_to_markdown(c.get("body"))
            is_ai = "🤖" in text or "Lumis AI" in text
            comments.append({
                "id": c.get("id", ""),
                "author": c.get("author", {}).get("displayName", "Unknown"),
                "text": text,
                "timestamp": c.get("updated", ""),
                "isAI": is_ai
            })

        tickets.append({
            "id": issue["id"],
            "key": issue["key"],
            "title": fields.get("summary", ""),
            "description": adf_to_markdown(fields.get("description")),
            "priority": fields.get("priority", {}).get("name", "Medium"),
            "status": fields.get("status", {}).get("id", ""),
            "assignee": assignee_data,
            "comments": comments
        })
        
    return tickets

def transition_issue_to_status(cloud_id: str, issue_id: str, target_status_id: str, access_token: str):
    """Attempts to move a Jira ticket. Raises an exception if blocked by Jira workflow rules."""
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_id}/transitions"
    headers = jira_headers(access_token)
    
    res = jira_session.get(url, headers=headers)
    res.raise_for_status()
    
    transitions = res.json().get("transitions", [])
    
    # Find the transition ID that leads to our target status ID
    transition_id = None
    for t in transitions:
        if str(t.get("to", {}).get("id")) == str(target_status_id):
            transition_id = t["id"]
            break
            
    if not transition_id:
        # Jira workflow prevents this move (e.g. Can't move from 'To Do' straight to 'Done')
        raise Exception("Jira workflow rules prevent moving this ticket to the selected column.")
        
    payload = {"transition": {"id": transition_id}}
    move_res = jira_session.post(url, headers=headers, json=payload)
    
    if move_res.status_code != 204:
        raise Exception(f"Failed to move ticket: {move_res.text}")
        
    return True

def delete_comment(cloud_id: str, issue_key: str, comment_id: str, access_token: str):
    """Deletes a specific comment from a Jira ticket."""
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}/comment/{comment_id}"
    res = jira_session.delete(url, headers=jira_headers(access_token))
    res.raise_for_status()
    return True

def get_assignable_users(cloud_id: str, project_key: str, access_token: str):
    """Fetches all users who can be assigned to issues in this Jira project."""
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/user/assignable/search?project={project_key}"
    res = jira_session.get(url, headers=jira_headers(access_token))
    
    if res.status_code != 200:
        logger.error(f"Failed to fetch users: {res.text}")
        return []
        
    users = []
    for u in res.json():
        # Filter out app bots, only keep real team members
        if u.get("accountType") == "atlassian":
            users.append({
                "accountId": u.get("accountId"),
                "name": u.get("displayName"),
                "avatar": u.get("avatarUrls", {}).get("48x48", "")
            })
    return users

def assign_issue(cloud_id: str, issue_key: str, account_id: str, access_token: str):
    """Assigns a Jira ticket to a specific user (or Unassigned if account_id is empty)."""
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}/assignee"
    
    # If account_id is empty or None, Jira interprets this as "Unassigned"
    payload = {"accountId": account_id} if account_id else {"accountId": None}
    
    res = jira_session.put(url, headers=jira_headers(access_token), json=payload)
    res.raise_for_status()
    return True

def update_issue_description(cloud_id: str, issue_key: str, description: str, access_token: str):
    """Updates the description of a Jira ticket, formatting newlines correctly."""
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}"
    
    # Split description by newlines to create separate ADF paragraphs
    paragraphs = []
    for p_text in description.split("\n"):
        if p_text.strip():
            paragraphs.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": p_text}]
            })
    
    # If the user cleared the description completely
    if not paragraphs:
        paragraphs = [{"type": "paragraph", "content": []}]
        
    payload = {
        "fields": {
            "description": {
                "type": "doc", 
                "version": 1, 
                "content": paragraphs
            }
        }
    }
    
    res = jira_session.put(url, headers=jira_headers(access_token), json=payload)
    res.raise_for_status()
    return True

def delete_issue(cloud_id: str, issue_key: str, access_token: str):
    """Deletes an issue entirely from Jira."""
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}"
    res = jira_session.delete(url, headers=jira_headers(access_token))
    res.raise_for_status()
    return True
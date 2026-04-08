import urllib.parse
import httpx
import asyncio
import logging
from src.config import Config

logger = logging.getLogger("LumisAPI")

# --- HIGH-PERFORMANCE ASYNC CLIENT ---
# Keeps connection pools open globally for fast repeated requests
jira_client = httpx.AsyncClient(timeout=15.0)

async def _request(method: str, url: str, headers: dict, json: dict = None):
    """Helper to execute async requests with exponential backoff for rate limits."""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await jira_client.request(method, url, headers=headers, json=json)
            # Retry on rate limits or server anomalies
            if response.status_code in [429, 500, 502, 503, 504]:
                logger.warning(f"Jira API {response.status_code} on {url}. Retry {attempt+1}/{max_retries}")
                await asyncio.sleep(2 ** attempt)
                continue
            response.raise_for_status()
            return response
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Jira request failed permanently: {e}")
                raise e
            await asyncio.sleep(2 ** attempt)

def jira_headers(access_token: str):
    return {"Authorization": f"Bearer {access_token}", "Accept": "application/json", "Content-Type": "application/json"}

async def get_accessible_resources(access_token: str):
    url = f"{Config.JIRA_API_BASE}/oauth/token/accessible-resources"
    res = await _request("GET", url, headers={"Authorization": f"Bearer {access_token}"})
    return res.json()

async def get_issue_details(cloud_id: str, issue_key: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}?fields=summary,description,status"
    res = await _request("GET", url, headers=jira_headers(access_token))
    return res.json()

async def add_comment(cloud_id: str, issue_key: str, comment: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}/comment"
    payload = {"body": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": comment}]}]}}
    await _request("POST", url, headers=jira_headers(access_token), json=payload)

async def transition_issue(cloud_id: str, issue_key: str, access_token: str, depth=0, target="review"):
    if depth > 3: 
        return

    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}/transitions"
    headers = jira_headers(access_token)
    
    response = await _request("GET", url, headers=headers)
    transitions = response.json().get("transitions", [])
    if not transitions: return
        
    review_transition, progress_transition, done_transition = None, None, None
    for t in transitions:
        dest_name = t["to"]["name"].lower()
        cat_key = t.get("to", {}).get("statusCategory", {}).get("key", "")
        
        if any(kw in dest_name for kw in ["review", "qa", "test", "pull request", "merge", "validate", "check", "pr"]):
            review_transition = t
        elif cat_key == "done":
            done_transition = t
        elif cat_key == "indeterminate" or "progress" in dest_name:
            progress_transition = t

    if target == "progress" and progress_transition:
        await _request("POST", url, headers=headers, json={"transition": {"id": progress_transition["id"]}})
        return

    if review_transition:
        await _request("POST", url, headers=headers, json={"transition": {"id": review_transition["id"]}})
        return
        
    if progress_transition:
        res = await _request("POST", url, headers=headers, json={"transition": {"id": progress_transition["id"]}})
        if res.status_code == 204:
            await asyncio.sleep(2.0)
            await transition_issue(cloud_id, issue_key, access_token, depth + 1, target="review")
        return

    if done_transition:
        await _request("POST", url, headers=headers, json={"transition": {"id": done_transition["id"]}})

async def create_issue(cloud_id: str, project_key: str, summary: str, description: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue"
    payload = {
        "fields": {
            "project": {"key": project_key}, "summary": summary,
            "description": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]},
            "issuetype": {"name": "Task"}
        }
    }
    res = await _request("POST", url, headers=jira_headers(access_token), json=payload)
    return res.json()

async def get_projects(cloud_id: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/project"
    res = await _request("GET", url, headers=jira_headers(access_token))
    return res.json()

async def get_active_issues(cloud_id: str, access_token: str, project_key: str = None):
    jql = f'project="{project_key}" AND statusCategory != Done ORDER BY updated DESC' if project_key else 'statusCategory != Done ORDER BY updated DESC'
    encoded_jql = urllib.parse.quote(jql)
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/search/jql?jql={encoded_jql}&maxResults=100&fields=summary,description,status"
    try:
        res = await _request("GET", url, headers=jira_headers(access_token))
        return res.json().get("issues", [])
    except:
        return []

def adf_to_markdown(adf_node):
    # (Kept identical: Synchronous processing)
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

async def get_project_statuses(cloud_id: str, project_key: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/project/{project_key}/statuses"
    res = await _request("GET", url, headers=jira_headers(access_token))
    columns_data, seen = [], set()
    for issue_type in res.json():
        for status in issue_type.get("statuses", []):
            s_id = status["id"]
            if s_id not in seen:
                seen.add(s_id)
                category = status.get("statusCategory", {})
                cat_color = category.get("colorName", "neutral")
                cat_key = category.get("key", "new")
                bg_color = "bg-slate-500"
                if cat_color == "blue": bg_color = "bg-blue-500"
                elif cat_color == "green": bg_color = "bg-emerald-500"
                elif cat_color == "yellow": bg_color = "bg-amber-500"

                columns_data.append({"id": s_id, "title": status["name"], "color": bg_color, "category_key": cat_key})
                
    def sort_columns(col):
        base_weight = {"new": 100, "indeterminate": 200, "done": 300}.get(col["category_key"], 400)
        title_lower = col["title"].lower()
        sub_weight = 50
        if col["category_key"] == "indeterminate":
            if any(kw in title_lower for kw in ["progress", "doing", "active", "dev", "build"]): sub_weight = 10
            elif any(kw in title_lower for kw in ["review", "qa", "test", "pr", "merge", "validate"]): sub_weight = 90
        return base_weight + sub_weight

    columns_data.sort(key=sort_columns)
    for col in columns_data: col.pop("category_key", None)
    return columns_data

async def get_board_issues(cloud_id: str, project_key: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/search/jql"
    payload = {"jql": f"project = {project_key} ORDER BY Rank ASC", "maxResults": 100, "fields": ["summary", "description", "status", "priority", "assignee", "comment"]}
    res = await _request("POST", url, headers=jira_headers(access_token), json=payload)
    
    tickets = []
    for issue in res.json().get("issues", []):
        fields = issue.get("fields", {})
        assignee = fields.get("assignee")
        assignee_data = {
            "name": assignee["displayName"] if assignee else "Unassigned",
            "avatar": assignee["avatarUrls"]["48x48"] if assignee else "https://api.dicebear.com/7.x/avataaars/svg?seed=Unassigned"
        }
        comments = []
        for c in fields.get("comment", {}).get("comments", []):
            text = adf_to_markdown(c.get("body"))
            comments.append({
                "id": c.get("id", ""), "author": c.get("author", {}).get("displayName", "Unknown"),
                "text": text, "timestamp": c.get("updated", ""), "isAI": "🤖" in text or "Lumis AI" in text
            })

        tickets.append({
            "id": issue["id"], "key": issue["key"], "title": fields.get("summary", ""),
            "description": adf_to_markdown(fields.get("description")), "priority": fields.get("priority", {}).get("name", "Medium"),
            "status": fields.get("status", {}).get("id", ""), "assignee": assignee_data, "comments": comments
        })
    return tickets

async def transition_issue_to_status(cloud_id: str, issue_id: str, target_status_id: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_id}/transitions"
    res = await _request("GET", url, headers=jira_headers(access_token))
    
    transition_id = None
    for t in res.json().get("transitions", []):
        if str(t.get("to", {}).get("id")) == str(target_status_id):
            transition_id = t["id"]
            break
            
    if not transition_id: raise Exception("Jira workflow rules prevent moving this ticket to the selected column.")
        
    await _request("POST", url, headers=jira_headers(access_token), json={"transition": {"id": transition_id}})
    return True

async def delete_comment(cloud_id: str, issue_key: str, comment_id: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}/comment/{comment_id}"
    await _request("DELETE", url, headers=jira_headers(access_token))
    return True

async def get_assignable_users(cloud_id: str, project_key: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/user/assignable/search?project={project_key}"
    res = await _request("GET", url, headers=jira_headers(access_token))
    users = []
    for u in res.json():
        if u.get("accountType") == "atlassian":
            users.append({"accountId": u.get("accountId"), "name": u.get("displayName"), "avatar": u.get("avatarUrls", {}).get("48x48", "")})
    return users

async def assign_issue(cloud_id: str, issue_key: str, account_id: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}/assignee"
    await _request("PUT", url, headers=jira_headers(access_token), json={"accountId": account_id} if account_id else {"accountId": None})
    return True

async def update_issue_description(cloud_id: str, issue_key: str, description: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}"
    paragraphs = []
    for p_text in description.split("\n"):
        if p_text.strip(): paragraphs.append({"type": "paragraph", "content": [{"type": "text", "text": p_text}]})
    if not paragraphs: paragraphs = [{"type": "paragraph", "content": []}]
    await _request("PUT", url, headers=jira_headers(access_token), json={"fields": {"description": {"type": "doc", "version": 1, "content": paragraphs}}})
    return True

async def update_issue_title(cloud_id: str, issue_key: str, title: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}"
    await _request("PUT", url, headers=jira_headers(access_token), json={"fields": {"summary": title}})
    return True

async def delete_issue(cloud_id: str, issue_key: str, access_token: str):
    url = f"{Config.JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}"
    await _request("DELETE", url, headers=jira_headers(access_token))
    return True
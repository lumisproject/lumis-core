import httpx
import asyncio
import logging

logger = logging.getLogger("LumisAPI")

NOTION_VERSION = "2022-06-28"
notion_client = httpx.AsyncClient(timeout=15.0)

async def _request(method: str, url: str, headers: dict, json: dict = None):
    """Helper to execute async requests with exponential backoff for rate limits."""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await notion_client.request(method, url, headers=headers, json=json)
            if response.status_code in [429, 500, 502, 503, 504]:
                logger.warning(f"Notion API {response.status_code} on {url}. Retry {attempt+1}/{max_retries}")
                await asyncio.sleep(2 ** attempt)
                continue
            response.raise_for_status()
            return response
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Notion request failed permanently: {e}")
                raise e
            await asyncio.sleep(2 ** attempt)

def notion_headers(access_token: str):
    return {"Authorization": f"Bearer {access_token}", "Notion-Version": NOTION_VERSION, "Content-Type": "application/json"}

async def get_accessible_databases(access_token: str):
    url = "https://api.notion.com/v1/search"
    res = await _request("POST", url, headers=notion_headers(access_token), json={"filter": {"value": "database", "property": "object"}})
    databases = []
    for db in res.json().get("results", []):
        title = db["title"][0].get("plain_text", "Untitled Database") if db.get("title") else "Untitled Database"
        databases.append({"id": db["id"], "name": title})
    return databases

async def get_active_tasks(database_id: str, access_token: str):
    url = f"https://api.notion.com/v1/databases/{database_id}/query"
    try:
        res = await _request("POST", url, headers=notion_headers(access_token), json={"sorts": [{"timestamp": "last_edited_time", "direction": "descending"}], "page_size": 10})
        tasks = []
        for page in res.json().get("results", []):
            props = page.get("properties", {})
            title = "Unknown Task"
            for key, val in props.items():
                if val.get("type") == "title" and val.get("title"):
                    title = val["title"][0].get("plain_text", title)
                    break
            tasks.append({"id": page["id"], "url": page.get("url"), "summary": title, "raw_properties": props})
        return tasks
    except:
        return []

async def add_comment(page_id: str, comment_text: str, access_token: str):
    url = "https://api.notion.com/v1/comments"
    await _request("POST", url, headers=notion_headers(access_token), json={"parent": {"page_id": page_id}, "rich_text": [{"text": {"content": comment_text}}]})

async def transition_task(page_id: str, access_token: str):
    url = f"https://api.notion.com/v1/pages/{page_id}"
    await _request("PATCH", url, headers=notion_headers(access_token), json={"properties": {"Status": {"status": {"name": "Done"}}}})

async def create_task(database_id: str, summary: str, description: str, access_token: str):
    url = "https://api.notion.com/v1/pages"
    payload = {
        "parent": {"database_id": database_id},
        "properties": {"Name": {"title": [{"text": {"content": summary}}]}},
        "children": [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": description}}]}}]
    }
    res = await _request("POST", url, headers=notion_headers(access_token), json=payload)
    return res.json()

async def get_database_schema(database_id: str, access_token: str):
    url = f"https://api.notion.com/v1/databases/{database_id}"
    res = await _request("GET", url, headers=notion_headers(access_token))
    properties = res.json().get("properties", {})
    
    schema = {"title_prop": None, "status_prop": None, "assignee_prop": None, "status_options": []}
    for prop_name, prop_data in properties.items():
        if prop_data["type"] == "title": schema["title_prop"] = prop_name
        elif prop_data["type"] in ["status", "select"]:
            if not schema["status_prop"] or prop_data["type"] == "status":
                schema["status_prop"] = prop_name
                schema["status_options"] = prop_data["status" if prop_data["type"] == "status" else "select"].get("options", [])
        elif prop_data["type"] == "people": schema["assignee_prop"] = prop_name
    return schema

async def get_notion_board_data(database_id: str, access_token: str):
    schema = await get_database_schema(database_id, access_token)
    columns = [{"id": opt["name"], "title": opt["name"], "color": opt.get("color", "default")} for opt in schema.get("status_options", [])]
    
    raw_tasks = await get_active_tasks(database_id, access_token)
    tickets = []
    for task in raw_tasks:
        props = task["raw_properties"]
        status_val = "Unknown"
        if schema["status_prop"] and schema["status_prop"] in props:
            status_obj = props[schema["status_prop"]].get(props[schema["status_prop"]]["type"])
            if status_obj: status_val = status_obj.get("name", "Unknown")

        tickets.append({"id": task["id"], "title": task["summary"], "status": status_val, "url": task["url"]})
    return {"columns": columns, "tickets": tickets}
import requests
import logging
from src.db_client import supabase
from src.config import Config

logger = logging.getLogger("LumisAPI")

def send_slack_risk_alert(project_id: str, repo_url: str):
    """
    Evaluates project risks and sends a high-signal Slack alert ONLY 
    if High or Critical risks were found. (Signal > Noise)
    """
    try:
        # 1. Check if project has a Slack channel mapped
        res = supabase.table("projects").select("user_id, slack_channel_id").eq("id", project_id).execute()
        if not res.data: return
        
        project = res.data[0]
        user_id = project.get("user_id")
        channel_id = project.get("slack_channel_id")
        
        if not channel_id:
            return # User hasn't linked a channel for this project
            
        # 2. Get the Slack OAuth token
        token_res = supabase.table("slack_tokens").select("access_token").eq("user_id", user_id).execute()
        if not token_res.data: return
        
        token = token_res.data[0]["access_token"]
        
        # 3. Fetch latest risks for this project from Supabase
        risks_res = supabase.table("project_risks").select("*").eq("project_id", project_id).execute()
        all_risks = risks_res.data if risks_res.data else []
        
        # 4. Filter only High/Critical risks (We do not want to spam developers!)
        high_risks = [r for r in all_risks if str(r.get("severity")).lower() in ["high", "critical"]]
        
        if not high_risks:
            logger.info("No high risks found. Skipping Slack alert (Signal > Noise).")
            return
            
        # 5. Build the beautiful Slack Block Kit Message
        repo_name = repo_url.split("/")[-1].replace(".git", "")
        dashboard_url = f"{Config.FRONTEND_URL}/app/dashboard"
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🚨 Lumis: High Severity Risks in {repo_name}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"Lumis just finished analyzing a recent push to *<{repo_url}|{repo_name}>*.\nI detected *{len(high_risks)} high-severity issue(s)* that require immediate engineering attention."
                }
            },
            {"type": "divider"}
        ]
        
        # Add the top 3 risks so the message isn't a mile long
        for risk in high_risks[:3]:
            # Safely handle affected_units
            affected = risk.get("affected_units", ["Unknown File"])
            file_name = affected[0] if isinstance(affected, list) and len(affected) > 0 else "Architecture"
            
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"🔴 *{risk.get('title', risk.get('risk_type', 'Risk'))}*\n*Location:* `{file_name}`\n_{risk.get('description', 'No description provided.')}_"
                }
            })
            
        if len(high_risks) > 3:
            blocks.append({
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"...and {len(high_risks) - 3} more critical risks. View the dashboard for full details."}]
            })
            
        # Add an Action Button
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "View in Dashboard", "emoji": True},
                    "url": dashboard_url,
                    "style": "primary"
                }
            ]
        })
        
        # 6. Send the payload to the Slack Web API
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "channel": channel_id,
            "blocks": blocks,
            "text": f"Lumis detected {len(high_risks)} high risks in {repo_name}" # Fallback text for mobile notifications
        }
        
        resp = requests.post("https://slack.com/api/chat.postMessage", headers=headers, json=payload)
        if not resp.json().get("ok"):
            logger.error(f"Failed to send Slack alert: {resp.text}")
        else:
            logger.info(f"✅ High-Signal Slack Alert sent to {channel_id}!")
            
    except Exception as e:
        logger.error(f"Slack Client Error: {e}")

def send_slack_thread_reply(channel_id: str, thread_ts: str, text: str, token: str):
    """Sends a message back to a specific Slack thread."""
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "channel": channel_id,
            "thread_ts": thread_ts,
            "text": text
        }
        requests.post("https://slack.com/api/chat.postMessage", headers=headers, json=payload)
    except Exception as e:
        logger.error(f"Failed to send Slack thread reply: {e}")
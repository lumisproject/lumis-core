import imaplib
import email
import asyncio
import logging
import datetime as dt
from email.utils import parseaddr
from src.db_client import supabase, get_global_user_config
from src.email_intake import synthesize_email_to_ticket
from src.cryptography import decrypt_value

logger = logging.getLogger("LumisAPI")

def get_text_body(msg):
    """Extracts the plain text body from a raw email payload."""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    return part.get_payload(decode=True).decode()
                except:
                    pass
    else:
        if msg.get_content_type() == "text/plain":
            try:
                return msg.get_payload(decode=True).decode()
            except:
                pass
    return ""

def process_unread_emails_sync():
    """Synchronous function to connect to IMAP, read emails, and process them for all users."""
    try:
        # 1. Fetch all users who have configured their Inbox Intake
        settings_res = supabase.table("user_settings")\
            .select("user_id, user_config")\
            .execute()
        
        if not settings_res.data:
            return

        # 2. Iterate through each user's intake configuration
        for setting in settings_res.data:
            user_id = setting["user_id"]
            config = setting.get("user_config", {})
            
            intake_user = config.get("intake_user")
            encrypted_pw = config.get("intake_password")
            
            if not intake_user or not encrypted_pw:
                continue
                
            try:
                intake_pw = decrypt_value(encrypted_pw)
            except Exception as e:
                logger.error(f"Failed to decrypt intake password for user {user_id}: {e}")
                continue

            # 3. Fetch client mappings for THIS user's projects
            mappings_res = supabase.table("project_email_mappings")\
                .select("project_id, client_email, projects!inner(user_id)")\
                .eq("projects.user_id", user_id)\
                .execute()
            
            if not mappings_res.data:
                continue

            mapped_clients = {item["client_email"].lower(): item["project_id"] for item in mappings_res.data}
            
            # 4. Connect to user's Inbox (Currently using IMAP for Gmail/Outlook)
            try:
                # FUTURE: Add logic to switch between IMAP, MS Graph (Outlook), and Slack Webhooks
                mail = imaplib.IMAP4_SSL("imap.gmail.com") # Default to Gmail for now, but using generic keys
                mail.login(intake_user, intake_pw)
                mail.select("inbox")
                
                logger.info(f"🎧 Listening to {intake_user}")

                for client_email, project_id in mapped_clients.items():
                    search_criteria = f'(UNSEEN FROM "{client_email}")'
                    status, response = mail.search(None, search_criteria)
                    
                    if status != "OK" or not response[0]:
                        continue
                        
                    email_ids = response[0].split()
                    for e_id in email_ids:
                        status, msg_data = mail.fetch(e_id, "(RFC822)")
                        for response_part in msg_data:
                            if isinstance(response_part, tuple):
                                msg = email.message_from_bytes(response_part[1])
                                subject = msg.get("Subject", "No Subject")
                                body = get_text_body(msg)
                                
                                user_config = get_global_user_config(user_id)
                                synthesis = synthesize_email_to_ticket(
                                    email_body=body,
                                    subject=subject,
                                    user_config=user_config,
                                )
                                
                                insert_payload = {
                                    "project_id": project_id,
                                    "title": synthesis.title,
                                    "description": synthesis.description,
                                    "original_email_summary": synthesis.summary,
                                    "status": "To Do",
                                    "sender_email": client_email,
                                    "received_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                                }
                                
                                supabase.table("draft_tickets").insert(insert_payload).execute()
                                logger.info(f"🎉 Draft ticket synthesized for {intake_user}!")

                mail.logout()
            except Exception as e:
                logger.error(f"Inbox Intake error for {intake_user}: {e}")

    except Exception as e:
        logger.error(f"Inbox Global Listener Error: {e}")

async def start_inbox_listener():
    """Asynchronous loop for polling."""
    logger.info("🎧 Lumis Multi-User Inbox Listener active")
    while True:
        try:
            await asyncio.to_thread(process_unread_emails_sync)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in Inbox listener loop: {e}")
        await asyncio.sleep(15)
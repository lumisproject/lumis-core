from __future__ import annotations

import datetime as dt
import json
import re
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

from src.db_client import supabase, get_current_user
from src.services import get_llm_completion


email_intake_router = APIRouter(tags=["email-intake"])

DraftStatus = Literal["To Do", "In Progress", "Done"]


class RawEmailPayload(BaseModel):
    sender_email: EmailStr
    subject: Optional[str] = None
    body: str
    received_at: Optional[dt.datetime] = None


class AcceptDraftPayload(BaseModel):
    title: str
    description: str
    status: DraftStatus = "To Do"
    draft_id: Optional[str] = None


class DraftTicketOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: str
    original_email_summary: str
    status: DraftStatus
    sender: EmailStr
    received_at: dt.datetime


class TicketSynthesis(BaseModel):
    title: str
    description: str
    summary: str


_JSON_OBJ_RE = re.compile(r"\{[\s\S]*\}")


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _extract_json_object(text: str) -> Optional[dict[str, Any]]:
    if not text:
        return None

    text = text.strip()

    # Fast path: exact JSON
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass

    # Tolerate model wrapping with prose/code fences.
    m = _JSON_OBJ_RE.search(text)
    if not m:
        return None

    try:
        obj = json.loads(m.group(0))
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def _fallback_synthesis(email_body: str, subject: Optional[str]) -> TicketSynthesis:
    body = (email_body or "").strip()
    body_one_line = re.sub(r"\s+", " ", body).strip()

    title = (subject or "").strip()
    if not title:
        title = " ".join(body_one_line.split(" ")[:10]).strip() or "New client request"

    summary = ""
    if body_one_line:
        # Best-effort first sentence.
        summary = re.split(r"(?<=[.!?])\s+", body_one_line, maxsplit=1)[0].strip()
    if not summary:
        summary = "Client sent a request via email."

    description = body.strip() if body else "(No email body provided.)"

    return TicketSynthesis(title=title[:120], description=description, summary=summary[:240])


def synthesize_email_to_ticket(email_body: str, subject: Optional[str] = None, user_config: Optional[dict] = None) -> TicketSynthesis:
    system_prompt = (
        "You are an expert software delivery analyst. Your goal is to transform client emails into high-fidelity engineering tickets. "
        "Remove all conversational fluff while preserving all technical intent, requirements, and acceptance criteria.\n\n"
        "CRITICAL RULE: You must base your output STRICTLY on the contents of the provided email. "
        "DO NOT invent, assume, infer, or add any features, requirements, edge cases, or timelines that are not explicitly stated by the client. "
        "If information for a specific section is missing, simply omit the section or state 'Not specified by client'.\n\n"
        "Return ONLY valid JSON with these keys: title, description, summary.\n"
        "- title: concise, technical service ticket title (max 120 chars)\n"
        "- summary: one sentence summarizing the overall request (max 240 chars)\n"
        "- description: A highly professional, structured technical brief. "
        "CRITICAL: Do NOT use Markdown symbols like '#', '**', or '*'. "
        "Instead, use clear section headers (e.g., CONTEXT, REQUIREMENTS, ACCEPTANCE CRITERIA) on separate lines. "
        "Under each header, use clean, indented bullet points with '-' for technical points. "
        "The overall look should be extremely precise, clean, and professional."
    )

    subject_line = (subject or "").strip()
    user_prompt = (
        f"Subject: {subject_line if subject_line else '(none)'}\n\n"
        "Email body:\n"
        f"{email_body.strip()}\n"
    )

    # Retry once if the LLM times out / returns invalid JSON.
    for _ in range(2):
        raw = get_llm_completion(system_prompt, user_prompt, user_config=user_config)
        obj = _extract_json_object(raw or "")
        if not obj:
            continue

        try:
            syn = TicketSynthesis(
                title=str(obj.get("title", "")).strip(),
                description=str(obj.get("description", "")).strip(),
                summary=str(obj.get("summary", "")).strip(),
            )
            if syn.title and syn.description and syn.summary:
                return syn
        except Exception:
            continue

    return _fallback_synthesis(email_body=email_body, subject=subject)


def _require_project_owner(project_id: str, current_user) -> dict[str, Any]:
    proj_res = (
        supabase.table("projects")
        .select("id, user_id, jira_project_id, notion_project_id")
        .eq("id", project_id)
        .limit(1)
        .execute()
    )

    if not proj_res or not proj_res.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = proj_res.data[0]
    if str(project.get("user_id")) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    return project


@email_intake_router.get("/api/projects/{project_id}/drafts", response_model=list[DraftTicketOut])
async def list_project_drafts(project_id: str, current_user=Depends(get_current_user)):
    _require_project_owner(project_id, current_user)

    res = (
        supabase.table("draft_tickets")
        .select("id, project_id, title, description, original_email_summary, status, sender_email, received_at")
        .eq("project_id", project_id)
        .order("received_at", desc=True)
        .execute()
    )

    drafts = res.data or []
    # Frontend expects `sender`, DB stores `sender_email`.
    return [
        {
            "id": d.get("id"),
            "project_id": d.get("project_id"),
            "title": d.get("title"),
            "description": d.get("description"),
            "original_email_summary": d.get("original_email_summary"),
            "status": d.get("status"),
            "sender": d.get("sender_email"),
            "received_at": d.get("received_at"),
        }
        for d in drafts
    ]


@email_intake_router.post("/api/projects/{project_id}/drafts", response_model=DraftTicketOut)
async def intake_email_to_draft(project_id: str, payload: RawEmailPayload):
    # 1) Ensure project exists.
    proj_res = supabase.table("projects").select("id").eq("id", project_id).limit(1).execute()
    if not proj_res or not proj_res.data:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2) Verify sender is mapped to this project.
    map_res = (
        supabase.table("project_email_mappings")
        .select("project_id")
        .eq("project_id", project_id)
        .eq("client_email", str(payload.sender_email).lower())
        .limit(1)
        .execute()
    )
    if not map_res or not map_res.data:
        raise HTTPException(status_code=403, detail="Sender email is not mapped to this project")

    # 3) Fetch project owner's configuration
    proj_owner_res = (
        supabase.table("projects")
        .select("user_id")
        .eq("id", project_id)
        .limit(1)
        .execute()
    )
    if not proj_owner_res or not proj_owner_res.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    owner_id = proj_owner_res.data[0]["user_id"]
    from src.db_client import get_global_user_config
    user_config = get_global_user_config(owner_id)

    # 4) Synthesize ticket content.
    synthesis = synthesize_email_to_ticket(
        email_body=payload.body,
        subject=payload.subject,
        user_config=user_config,
    )

    received_at = payload.received_at or _utcnow()

    insert_payload = {
        "project_id": project_id,
        "title": synthesis.title,
        "description": synthesis.description,
        "original_email_summary": synthesis.summary,
        "status": "To Do",
        "sender_email": str(payload.sender_email).lower(),
        "received_at": received_at.isoformat(),
    }

    ins = supabase.table("draft_tickets").insert(insert_payload).execute()
    if not ins or not ins.data:
        raise HTTPException(status_code=500, detail="Failed to create draft")

    d = ins.data[0]
    return {
        "id": d.get("id"),
        "project_id": d.get("project_id"),
        "title": d.get("title"),
        "description": d.get("description"),
        "original_email_summary": d.get("original_email_summary"),
        "status": d.get("status"),
        "sender": d.get("sender_email"),
        "received_at": d.get("received_at"),
    }


@email_intake_router.post("/api/projects/{project_id}/board/tickets")
async def accept_draft_to_board(project_id: str, payload: AcceptDraftPayload, current_user=Depends(get_current_user)):
    project = _require_project_owner(project_id, current_user)

    # Create ticket in connected tool (Jira or Notion). Mirrors server.py create_board_ticket behavior.
    jira_project_key = project.get("jira_project_id")
    notion_db_id = project.get("notion_project_id")

    created = None

    if jira_project_key:
        from src.jira_auth import get_valid_token
        from src.jira_client import get_accessible_resources, create_issue, transition_issue_to_status

        access_token = get_valid_token(project.get("user_id"))
        if not access_token:
            raise HTTPException(status_code=401, detail="Jira authentication expired or missing.")

        cloud_id = get_accessible_resources(access_token)[0]["id"]
        created = create_issue(cloud_id, jira_project_key, payload.title, payload.description, access_token)

        if payload.status:
            try:
                transition_issue_to_status(cloud_id, created["id"], payload.status, access_token)
            except Exception:
                pass

    elif notion_db_id:
        from src.notion_auth import get_valid_notion_token
        from src.notion_client import create_task

        access_token = get_valid_notion_token(project.get("user_id"))
        if not access_token:
            raise HTTPException(status_code=401, detail="Notion authentication expired or missing.")

        created = create_task(notion_db_id, payload.title, payload.description, access_token)

    else:
        raise HTTPException(status_code=400, detail="Tool not supported or project not mapped.")

    # Delete the draft once accepted.
    if payload.draft_id:
        existing = (
            supabase.table("draft_tickets")
            .select("id")
            .eq("id", payload.draft_id)
            .eq("project_id", project_id)
            .limit(1)
            .execute()
        )
        if not existing or not existing.data:
            raise HTTPException(status_code=404, detail="Draft not found")

        supabase.table("draft_tickets").delete().eq("id", payload.draft_id).eq("project_id", project_id).execute()

    return {"status": "success", "ticket": created}


@email_intake_router.delete("/api/projects/{project_id}/drafts/{draft_id}")
async def delete_draft(project_id: str, draft_id: str, current_user=Depends(get_current_user)):
    _require_project_owner(project_id, current_user)

    existing = (
        supabase.table("draft_tickets")
        .select("id")
        .eq("id", draft_id)
        .eq("project_id", project_id)
        .limit(1)
        .execute()
    )
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Draft not found")

    supabase.table("draft_tickets").delete().eq("id", draft_id).eq("project_id", project_id).execute()
    return {"status": "deleted"}


@email_intake_router.get("/api/projects/{project_id}/email-mappings")
async def list_email_mappings(project_id: str, current_user=Depends(get_current_user)):
    _require_project_owner(project_id, current_user)
    res = supabase.table("project_email_mappings").select("client_email").eq("project_id", project_id).execute()
    return [d["client_email"] for d in res.data or []]


@email_intake_router.post("/api/projects/{project_id}/email-mappings")
async def add_email_mapping(project_id: str, payload: dict, current_user=Depends(get_current_user)):
    _require_project_owner(project_id, current_user)
    email = str(payload.get("email", "")).lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Check if already exists
    exists = supabase.table("project_email_mappings").select("project_id").eq("project_id", project_id).eq("client_email", email).execute()
    if exists.data:
         return {"status": "already_exists"}

    supabase.table("project_email_mappings").insert({"project_id": project_id, "client_email": email}).execute()
    return {"status": "success"}


@email_intake_router.delete("/api/projects/{project_id}/email-mappings")
async def remove_email_mapping(project_id: str, email: str, current_user=Depends(get_current_user)):
    _require_project_owner(project_id, current_user)
    email = email.lower()
    supabase.table("project_email_mappings").delete().eq("project_id", project_id).eq("client_email", email).execute()
    return {"status": "success"}

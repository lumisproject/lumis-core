import json
import re
import logging
import asyncio
import ast
from typing import List, Dict, Any, Optional
from langchain_core.messages import BaseMessage
from src.services import get_llm_completion
from src.retriever import GraphRetriever
from src.answer_generator import AnswerGenerator
from src.query_processor import QueryProcessor
from src.db_client import supabase

class LumisAgent:
    def __init__(self, project_id: str, max_steps: int = 5, user_config: Dict = None, mode: str = "single-turn", session_id: str = None):
        self.project_id = project_id
        self.session_id = session_id
        self.user_config = user_config or {}
        if "mode" not in self.user_config:
            self.user_config["mode"] = mode
        if "reasoning" in self.user_config:
            self.user_config["reasoning_enabled"] = self.user_config.get("reasoning")

        self.retriever = GraphRetriever(project_id)
        self.generator = AnswerGenerator(project_id)
        self.query_processor = QueryProcessor()
        self.max_steps = max_steps
        self.conversation_history: List[Dict] = []
        self.logger = logging.getLogger(__name__)

        # If a session ID is provided, load the history from Supabase
        if self.session_id and self.user_config.get("mode") == "multi-turn":
            try:
                res = supabase.table("chat_messages").select("role, content").eq("session_id", self.session_id).order("created_at", asc=True).execute()
                if res.data:
                    for msg in res.data:
                        self.conversation_history.append({"role": msg["role"], "content": msg["content"]})
            except Exception as e:
                self.logger.error(f"Failed to load chat history from DB: {e}")

    async def ask_stream(self, user_query: str):
        """ Main entry point for user queries. Intercepts keywords to trigger
            task cross-referencing, otherwise proceeds with code analysis. """
        
        mode = self.user_config.get("mode", "single-turn")
        
        if mode == "single-turn":
            self.conversation_history = []

        scratchpad = []
        collected_elements = [] 
        repo_structure = None 
        
        self.logger.info(f"🤖 LUMIS: {user_query}")
        self.logger.info(f"Reasoning Enabled: {self.user_config.get('reasoning_enabled', False)}")
        self.logger.info(f"LLM Provider: {self.user_config.get('provider', 'default')} | Model: {self.user_config.get('model', 'default')}")
        self.logger.info(f"--- Starting {'Multi-Turn' if mode == 'multi-turn' else 'Single-Turn'} Interaction ---")

        yield json.dumps({"type": "thought", "content": f"Received query. Brain engaging..."})

        # Process query asynchronously to avoid blocking
        processed_query = await asyncio.to_thread(self.query_processor.process, user_query, self.conversation_history, user_config=self.user_config)
        
        # --- TERMINAL LOG ---
        self.logger.info(f"🎯 Intent: {processed_query.intent}")
        
        yield json.dumps({"type": "thought", "content": f"Intent Decoded: {processed_query.intent}"})
        
        if processed_query.pseudocode_hints:
            self.logger.info(f"💡 Pseudocode Hint Generated")
            yield json.dumps({"type": "thought", "content": f"Formulated Search Hint: {processed_query.pseudocode_hints[:100]}..."})

        for step in range(self.max_steps):
            # Still use the synchronous completion here since we need the FULL JSON object to parse it before moving forward
            user_config = {**(self.user_config or {}), "feature_mode": "chat"}
            response_text = await asyncio.to_thread(
                get_llm_completion,
                self._get_system_prompt(), 
                self._build_step_prompt(processed_query, scratchpad),
                user_config=user_config
            )
            
            data = self._parse_response(response_text, fallback_query=user_query)
            thought = data.get("thought", "Analyzing...")
            action = data.get("action")
            confidence = data.get("confidence", 0)
            
            self.logger.info(f"🤔 Step {step+1} ({confidence}%, ({action})): {thought}")

            yield json.dumps({"type": "thought", "content": f"[{confidence}%] {thought}"})

            if action == "final_answer":
                yield json.dumps({"type": "thought", "content": "Confidence threshold reached. Formulating final answer."})
                break
            
            obs = await asyncio.to_thread(self._execute_tool, action, data.get("action_input"), collected_elements, scratchpad, processed_query)
            
            self.logger.info(f"\n\n🔧 Executed {action} with input '{data.get('action_input')}'. Observation: {obs}\n\n")
            
            yield json.dumps({"type": "tool", "content": f"Action Executed: {action}({data.get('action_input')})"})
            
            if action == "list_files": 
                repo_structure = obs 

        # Signal that the reasoning loop has ended and streaming text will begin
        yield json.dumps({"type": "answer_start"})
        
        # ---> CHANGED: Removed the word "Tool" to prevent Groq hallucinations <---
        action_results_str = "\n".join([f"System Action: {s['action']}\nResult: {s['observation']}" for s in scratchpad])
        
        full_answer = ""
        async for chunk in self.generator.generate_stream(
            query=user_query, 
            collected_elements=collected_elements, 
            repo_structure=repo_structure,
            history=self.conversation_history,
            user_config=self.user_config,
            tool_results=action_results_str 
        ):
            full_answer += chunk
            yield json.dumps({"type": "answer_chunk", "content": chunk})
            
        # Try to extract the true answer and internal memory summary from the accumulated text
        answer_only, _ = self.generator._parse_response_with_summary(full_answer)
        self._update_history(user_query, answer_only, mode)

    def _build_step_prompt(self, processed_query, scratchpad):
        history_text = ""
        if self.conversation_history and len(self.conversation_history) > 0:
            recent_msgs = self.conversation_history[-6:]
            history_text = "CONVERSATION HISTORY:\n" + "\n".join(
                [f"{m['role'].upper() if isinstance(m, dict) else getattr(m, 'type', '').upper()}: {m['content'] if isinstance(m, dict) else getattr(m, 'content', '')}" for m in recent_msgs]
            ) + "\n\n"
            
        progress = "\n".join([f"Action: {s['action']} -> {s['observation']}" for s in scratchpad])
        query_context = f"USER QUERY: {processed_query.original}"
        
        insights = []
        if processed_query.rewritten_query:
             insights.append(f"Search Hint: Try searching for '{processed_query.rewritten_query}'")
        if processed_query.pseudocode_hints:
             insights.append(f"Implementation Hint:\n{processed_query.pseudocode_hints}")
             
        insight_text = "\n\n".join(insights)
        return f"""
        {history_text}
        {query_context}

        {insight_text}

        PROGRESS:
        {progress}

        ---
        RE-STATED SYSTEM RULES:
        1. Only use the provided tools.
        2. Respond ONLY with a valid JSON object.
        3. Do NOT include markdown formatting or extra text.
        ---
        NEXT JSON:"""    
    def _parse_response(self, text: str, fallback_query: str = "") -> Dict[str, Any]:
        if not text: 
            return self._create_fallback(fallback_query, "Empty response from LLM")
        
        # Catch XML tool calls from stubborn models (like Stepfun or Claude)
        if "<tool_call>" in text or "<function=" in text:
            import re
            func_match = re.search(r'<function=([^>]+)>', text)
            param_match = re.search(r'<parameter=[^>]+>\s*(.*?)\s*</parameter>', text, re.DOTALL)
            if func_match:
                action = func_match.group(1).strip()
                action_input = param_match.group(1).strip() if param_match else fallback_query
                return {
                    "thought": "Model used XML format. Translating to JSON action...",
                    "action": action,
                    "action_input": action_input,
                    "confidence": 90
                }
            
        # Existing JSON parsing logic  
        clean_text = text.replace("```json", "").replace("```", "").strip()
        start_idx = clean_text.find('{')
        end_idx = clean_text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            try:
                json_str = self._sanitize_json_string(clean_text[start_idx:end_idx + 1])
                return json.loads(json_str)
            except Exception: pass
        try:
            if start_idx != -1 and end_idx != -1:
                return ast.literal_eval(clean_text[start_idx:end_idx + 1])
        except: pass
        return self._create_fallback(fallback_query, text[:200])

    def _create_fallback(self, query: str, thought_snippet: str) -> Dict[str, Any]:
        return {
            "thought": f"Parsing failed. Falling back to search. Raw: {thought_snippet}...",
            "action": "search_code",
            "action_input": query,
            "confidence": 50
        }

    def _sanitize_json_string(self, json_str: str) -> str:
        json_str = re.sub(r'//.*?\n', '\n', json_str)
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        return json_str

    def _execute_tool(self, action, inp, collected, scratchpad, processed_query=None):
        obs = "No results."
        try:
            if action == "list_files":
                files = self.retriever.list_all_files()
                obs = f"Repo contains {len(files)} files. First 50: {', '.join(files[:50])}"
                
            elif action == "read_file":
                path = str(inp).strip()
                data = self.retriever.fetch_file_content(path)
                if data:
                    collected.extend(data)
                    file_content = data[0].get('content', '')
                    preview = file_content[:3000] + ("\n...[truncated]" if len(file_content) > 3000 else "")
                    obs = f"Successfully read {path}. Contents:\n{preview}"
                else:
                    obs = f"Error: File {path} not found."
                    
            elif action == "search_code":
                search_input = str(inp)
                if processed_query and processed_query.rewritten_query:
                    search_input = f"{search_input} {processed_query.rewritten_query}"
                if processed_query and processed_query.pseudocode_hints:
                    search_input += f" {processed_query.pseudocode_hints}"
                
                data = self.retriever.search(search_input, user_config=self.user_config)
                if data:
                    collected.extend(data)
                    found_matches = []
                    for d in data[:5]: 
                        found_matches.append(f"- {d['file_path']} ({d['unit_name']})")
                    obs = f"Found {len(data)} matches. Top results context:\n" + "\n".join(found_matches)
                else:
                    obs = "No results found. Try broader keywords."

            elif action == "search_tickets":
                user_id = self.user_config.get("user_id")
                data = self.retriever.search_tickets(str(inp), user_id=user_id)
                if data:
                    collected.extend(data)
                    obs = f"Found {len(data)} related tickets."
                else:
                    obs = "No active tickets found matching the query."

            elif action == "search_commits":
                data = self.retriever.search_commits(str(inp))
                if data:
                    collected.extend(data)
                    obs = f"Found {len(data)} related commits."
                else:
                    obs = "No commits found matching the query."

            elif action == "modify_code_block":
                try:
                    import json
                    import ast
                    
                    # Robust parsing: Handle both Dicts and Stringified JSON
                    args = inp if isinstance(inp, dict) else json.loads(str(inp))
                    
                    file_path = args.get("file_path", "")
                    unit_name = args.get("unit_name", "")
                    new_code = args.get("code", "")
                    
                    # 1. Zero-Token Syntax Validation
                    if file_path.endswith(".py"):
                        try:
                            ast.parse(new_code)
                        except SyntaxError as se:
                            obs = f"AST Syntax Error on line {se.lineno}: {se.msg}. Please fix the code and try again."
                            scratchpad.append({"thought": "System Result", "action": f"{action}", "observation": obs})
                            return obs

                    # 2. Fetch the original function and the parent file
                    existing_units = supabase.table("memory_units")\
                        .select("id, unit_name, unit_type, content")\
                        .eq("project_id", self.project_id)\
                        .eq("file_path", file_path)\
                        .in_("unit_type", ["function", "class", "method", "file"])\
                        .execute()

                    target_unit = next((u for u in existing_units.data if u["unit_name"] == unit_name), None)
                    parent_file = next((u for u in existing_units.data if u["unit_type"] == "file"), None)

                    # 3. Splice the new code into the parent file
                    if target_unit and parent_file:
                        old_code = target_unit["content"]
                        full_file_content = parent_file["content"]
                        
                        # Replace the old function code with the new one in the main file
                        if old_code in full_file_content:
                            updated_file_content = full_file_content.replace(old_code, new_code)
                            
                            # Update the parent file unit in the DB
                            supabase.table("memory_units").update({
                                "content": updated_file_content
                            }).eq("id", parent_file["id"]).execute()
                        else:
                            self.logger.warning(f"Could not find exact string match for {unit_name} in {file_path} to splice.")

                    # 4. Update the target function unit in the DB
                    supabase.table("memory_units").upsert({
                        "project_id": self.project_id,
                        "file_path": file_path,
                        "unit_name": unit_name,
                        "unit_type": target_unit["unit_type"] if target_unit else "function",
                        "content": new_code,
                    }, on_conflict="project_id, file_path, unit_name").execute()
                    
                    obs = f"Successfully validated and updated `{unit_name}` in `{file_path}`."
                except Exception as e:
                    obs = f"Failed to parse modify_code_block input or save: {str(e)}. Ensure input is valid JSON."

            elif action == "manage_ticket":
                import asyncio
                
                # Robustly handle both stringified JSON and native Dictionary inputs
                args = inp if isinstance(inp, dict) else {}
                if not args:
                    import json
                    try:
                        args = json.loads(str(inp))
                    except Exception:
                        obs = "Error: Invalid JSON input format for manage_ticket."
                        scratchpad.append({"thought": "System Result", "action": action, "observation": obs})
                        return obs

                operation = args.get("operation")
                user_id = self.user_config.get("user_id")
                
                if not user_id:
                    obs = "Error: User ID missing. Cannot authenticate with project board."
                else:
                    res = supabase.table("projects").select("jira_project_id").eq("id", self.project_id).limit(1).execute()
                    jira_project_key = res.data[0].get("jira_project_id") if res.data else None
                    
                    if not jira_project_key:
                        obs = "Error: No Jira project mapped."
                    else:
                        from src.jira_auth import get_valid_token
                        access_token = get_valid_token(user_id)
                        
                        if not access_token:
                            obs = "Error: Jira token missing or expired."
                        else:
                            from src.jira_client import get_accessible_resources
                            
                            async def execute_jira_op():
                                resources = await get_accessible_resources(access_token)
                                cloud_id = resources[0]["id"]
                                
                                result_msg = f"Error: Unknown operation {operation}."
                                
                                if operation == "create":
                                    from src.jira_client import create_issue
                                    title = args.get("title") or args.get("summary") or "New Task"
                                    desc = args.get("description") or args.get("desc") or ""
                                    issue = await create_issue(cloud_id, jira_project_key, title, desc, access_token)
                                    result_msg = f"Successfully created ticket {issue['key']}."
                                    
                                elif operation == "update":
                                    from src.jira_client import update_issue_title, update_issue_description
                                    ticket_id = args.get("ticket_id")
                                    title = args.get("title") or args.get("summary")
                                    desc = args.get("description") or args.get("desc")
                                    
                                    if not ticket_id: return "Error: ticket_id required for update."
                                    
                                    if title:
                                        await update_issue_title(cloud_id, ticket_id, title, access_token)
                                    if desc:
                                        await update_issue_description(cloud_id, ticket_id, desc, access_token)
                                    result_msg = f"Successfully updated ticket {ticket_id}."
                                    
                                elif operation == "comment":
                                    from src.jira_client import add_comment
                                    ticket_id = args.get("ticket_id")
                                    comment_val = args.get("comment_text") or args.get("comment") or args.get("text")
                                    
                                    if not ticket_id: return "Error: ticket_id required for comment."
                                    if not comment_val: return "Error: comment text is empty."
                                    
                                    await add_comment(cloud_id, ticket_id, comment_val, access_token)
                                    result_msg = f"Successfully added comment to {ticket_id}."
                                    
                                elif operation == "delete":
                                    from src.jira_client import delete_issue
                                    ticket_id = args.get("ticket_id")
                                    if not ticket_id: return "Error: ticket_id required for delete."
                                    await delete_issue(cloud_id, ticket_id, access_token)
                                    result_msg = f"Successfully deleted ticket {ticket_id}."
                                
                                if "Successfully" in result_msg:
                                    from src.cache import invalidate_cache
                                    invalidate_cache(f"board:{self.project_id}:jira")
                                    
                                return result_msg
                            
                            try:
                                obs = asyncio.run(execute_jira_op())
                            except Exception as e:
                                obs = f"Failed to execute Jira operation: {str(e)}"

        except Exception as e:
            obs = f"Tool Error: {str(e)}"
            
        scratchpad.append({"thought": "System Result", "action": f"{action}({str(inp)[:50]}...)", "observation": obs})
        return obs

    def _get_system_prompt(self) -> str:
        return (
            "You are Lumis, an elite AI Developer and Architect.\n"
            "Your goal is to answer queries, write/modify code, and manage project context (tickets/commits).\n\n"
            "AVAILABLE COMMANDS (Output raw text JSON only):\n"
            "1. `list_files` - List repository files.\n"
            "2. `read_file` - Read full file content. ALWAYS use this FIRST when reviewing specific files. The code will be returned in your observation.\n"
            "3. `search_code` - Semantic search for code context.\n"
            "4. `modify_code_block` - Write or overwrite a specific function/class. Requires a JSON object with: 'file_path', 'unit_name', and 'code'. You MUST provide valid code.\n"
            "5. `search_tickets` - Search active tickets on the live project board (Jira).\n"
            "6. `search_commits` - Search git history to understand why code changed.\n"
            "7. `manage_ticket` - Create, update, comment on, or delete a ticket on the live board.\n"
            "   Requires a JSON object with: 'operation' (create|update|comment|delete), 'ticket_id' (for update/comment/delete), 'title', 'description', and 'comment_text' as needed.\n"
            "8. `final_answer` - Use this command ONLY when the user's entire request has been successfully completed.\n\n"
            "CRITICAL INSTRUCTION: You MUST NOT output anything that looks like `{\"name\": \"tool_name\", \"arguments\": {...}}`. "
            "Respond ONLY with a valid JSON string matching this EXACT schema:\n"
            "{\n"
            '  "thought": "Your reasoning",\n'
            '  "action": "COMMAND_NAME_HERE",\n'
            '  "action_input": "String input OR Stringified JSON for complex commands",\n'
            '  "confidence": 85\n'
            "}\n"
            "- Do NOT include markdown formatting (no ```json). Only respond with the raw JSON object.\n"
            "WORKFLOW RULES:\n"
            "- If asked to review a file and create a ticket, you MUST first execute `read_file`, analyze the observation, then execute `manage_ticket` to create the ticket, and ONLY THEN use `final_answer`.\n"
            "- If you lack file contents, DO NOT use `final_answer` to give up. You MUST use the `read_file` command to fetch the code yourself!\n"
            "- To modify or comment on a ticket, you MUST know its exact `ticket_id` (e.g., PROJ-123). If the user only provides a title, use `search_tickets` FIRST to find the ID, then use `manage_ticket`.\n"
            "- NEVER claim a ticket was updated or created unless you see a success message from `manage_ticket`.\n"
            "UNIVERSAL STOPPING RULE: The moment your command successfully achieves the user's primary request (e.g., 'Successfully created ticket XYZ'), your VERY NEXT command MUST be `final_answer`.\n"
        )

    def _update_history(self, q, a, mode):
            # 1. LLM MEMORY (Only happens if Multi-Turn is ON)
            # This controls what gets fed back into the AI's prompt context
            if mode == "multi-turn":
                self.conversation_history.append({"role": "user", "content": q})
                self.conversation_history.append({"role": "assistant", "content": a})

            user_id = self.user_config.get("user_id")

            # 2. DATABASE HISTORY
            # This controls the left sidebar so users can find old messages
            if user_id:
                try:
                    # Create session if it doesn't exist
                    if not self.session_id:
                        title = q[:30] + "..." if len(q) > 30 else q
                        res = supabase.table("chat_sessions").insert({
                            "project_id": self.project_id,
                            "user_id": user_id,
                            "title": title
                        }).execute()
                        if res.data:
                            self.session_id = res.data[0]["id"]
                    
                    # Insert messages to DB ALWAYS
                    if self.session_id:
                        supabase.table("chat_messages").insert([
                            {"session_id": self.session_id, "user_id": user_id, "role": "user", "content": q},
                            {"session_id": self.session_id, "user_id": user_id, "role": "assistant", "content": a}
                        ]).execute()
                        
                        # Update session timestamp
                        from datetime import datetime, timezone
                        now_str = datetime.now(timezone.utc).isoformat()
                        supabase.table("chat_sessions").update({"updated_at": now_str}).eq("id", self.session_id).execute()
                except Exception as e:
                    self.logger.error(f"Failed to persist chat history to database: {e}")

    def analyze_fulfillment(self, issue: Dict, code: str, previous_context: str = "") -> Dict:
        summary = issue.get("fields", {}).get("summary", "No Summary")
        description = issue.get("fields", {}).get("description", "No Description")
        
        context_block = f"\nPREVIOUS LUMIS UPDATES ON THIS TICKET:\n{previous_context}" if previous_context else ""

        system_prompt = f"""
        You are a STRICT Technical Lead evaluating if a developer's latest code commit fully completes their active task.

        EVALUATION RULES:
        1. STRICT COMPLETION: You must verify the code against ALL core requirements in the task description. If the task asks for "A and B" (e.g., add and subtract) and the code only has "A", you MUST mark it as "PARTIAL". Do NOT give the benefit of the doubt.
        2. Context Awareness: This is just a push. Read the "PREVIOUS LUMIS UPDATES" to see what was already done in past commits.
        3. Determine if the COMBINATION of previous updates and this new commit completes the ENTIRE task.

        STATUS DEFINITIONS:
        - "COMPLETE": Every single requirement in the description is fully implemented.
        - "PARTIAL": Some requirements are met, but others are missing.
        - "NONE": Unrelated code.

        JSON OUTPUT FORMAT (STRICT):
        {{
          "fulfillment_status": "COMPLETE" | "PARTIAL" | "NONE",
          "summary": "A precise professional summary. DO NOT use symbols like '#', '**', or '*'. Provide a clean, structured response."
        }}
        """
        
        prompt = f"""
        TASK SUMMARY: {summary}
        TASK DESCRIPTION: {description}{context_block}
        CODE CHANGES (DIFF): {code}
        """
        
        try:
            from src.services import get_llm_completion
            import json
            import re
            user_config = {**(self.user_config or {}), "feature_mode": "chat"}
            response_text = get_llm_completion(system_prompt, prompt, user_config=user_config)
            
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            return {"fulfillment_status": "PARTIAL", "summary": "Code synced but JSON parsing failed."}
            
        except Exception as e:
            self.logger.error(f"AI Engine Error: {e}")
            return {"fulfillment_status": "PARTIAL", "summary": "AI analysis failed."}

    def match_task_to_commit(self, commit_message: str, issues: List[Dict]) -> Optional[Dict]:
        """Uses AI to determine if a commit message matches one of the active tasks."""
        if not issues: return None

        candidates = "\n".join([f"- [{i['key']}] {i['fields']['summary']}" for i in issues])

        print(f"\n--- DEBUG: ACTIVE TASKS FED TO AI ---")
        print(candidates)
        print(f"-------------------------------------\n")
        
        system_prompt = "You are a Technical Lead. Your job is to match a developer's commit message to their active task."
        user_prompt = f"""
        COMMIT MESSAGE: "{commit_message}"
        
        ACTIVE TASKS:
        {candidates}
        
        Analyze the commit message and match it to the most relevant task.
        Output ONLY the exact Task ID from inside the brackets (e.g., PROJ-123) of the matching task.
        Do NOT output the summary or any other text. 
        If absolutely no tasks are relevant, output exactly NONE.
        """

        try:
            user_config = {**(self.user_config or {}), "feature_mode": "chat"}
            response = get_llm_completion(system_prompt, user_prompt, user_config=user_config)
            match_id = response.strip().upper()
            
            if "NONE" in match_id: return None
            
            return next((i for i in issues if i['key'] in match_id), None)
        except Exception:
            return None
    
    def analyze_risks(self, commit_message: str, code: str) -> dict:
        """
        Standalone AI code reviewer that uses graph context to predict 
        breaking changes and side effects.
        """
        potential_units = re.findall(r'(?:def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)', code[:10000])
        graph_context = self.retriever.get_architectural_context(potential_units)

        system_prompt = """
        You are an elite, pragmatic Senior Code Reviewer and Software Architect.
        Analyze the provided code diff for bugs, security risks, and breaking changes.
        
        CRITICAL RULES:
        1. MINIMIZE FALSE POSITIVES: You are highly conservative. Do NOT flag minor stylistic choices, standard refactoring, missing docstrings, or highly theoretical edge cases. ONLY flag concrete, provable bugs or severe architectural violations. If in doubt, do not flag it.
        2. DEEP STATE ANALYSIS: You must carefully trace variable lifecycles, data flow, and state mutations across the diff. 
        3. ARCHITECTURAL AWARENESS: Use the 'ARCHITECTURAL CONTEXT' to identify side-effects on dependent systems (e.g., changing a signature that breaks a neighbor).
        
        JSON OUTPUT FORMAT (STRICT):
        {
          "analysis_trace": "Step-by-step execution trace. Briefly track variable state changes and logic flow here BEFORE concluding risks.",
          "identified_risks": [
            {
              "risk_type": "SECURITY_FLAW" | "BUG" | "TECH_DEBT" | "BREAKING_CHANGE",
              "severity": "High" | "Medium" | "Low",
              "description": "Precise explanation using plain text. DO NOT use symbols like '#', '**', or '*'. Use '-' for bullet points.",
              "affected_units": ["name_of_function_or_file"]
            }
          ]
        }
        - If the code is safe and has no concrete risks, leave "identified_risks" as an empty array [].
        """
        
        user_prompt = f"""
        COMMIT MESSAGE: {commit_message}
        
        ARCHITECTURAL CONTEXT (Graph Neighbors):
        {graph_context}
        
        CODE:
        {code}
        """
        
        try:
            from src.services import get_llm_completion
            user_config = self.user_config.copy()
            user_config["reasoning_enabled"] = False
            user_config["feature_mode"] = "risk"
            response_text = get_llm_completion(system_prompt, user_prompt, user_config=user_config)
            
            if not response_text:
                self.logger.error("LLM returned None. Skipping risk analysis.")
                return {"identified_risks": []}
            
            clean_json = response_text.strip().replace('```json', '').replace('```', '')
            start_idx = clean_json.find('{')
            end_idx = clean_json.rfind('}')
            if start_idx != -1 and end_idx != -1:
                import json
                return json.loads(clean_json[start_idx:end_idx + 1])
            import json
            return json.loads(clean_json)
        except Exception as e:
            self.logger.error(f"Code reviewer error: {e}")
            return {"identified_risks": []}
    
    def analyze_architectural_risks(self, unit_name: str, code: str, graph_context: str) -> dict:
        """
        Aggressively evaluates a specific code slice against its graph dependencies 
        to detect architectural rot and scope creep.
        """
        system_prompt = """
        You are a highly aggressive, strict Staff Software Architect.
        Your goal is to protect the codebase from Architectural Degradation, Tight Coupling, and Breaking Changes.
        
        CRITICAL RULES:
        1. Look closely at the TARGET UNIT and its GRAPH CONTEXT (what it calls, and who calls it).
        2. AGGRESSIVELY FLAG:
           - Tight Coupling / Bypassing Data Layers.
           - Breaking Contracts (Changing behavior that will break the 'Callers' in the Graph).
           - Circular Dependencies.
           - God Objects / Unbounded Scope.
        3. Do NOT flag minor stylistic choices. Only flag structural/architectural issues.
        
        JSON OUTPUT FORMAT (STRICT):
        {
          "analysis_trace": "Briefly track how this unit interacts with its neighbors.",
          "identified_risks": [
            {
              "risk_type": "TIGHT_COUPLING" | "CONTRACT_BREAK" | "CIRCULAR_DEPENDENCY" | "ARCHITECTURAL_FLAW",
              "severity": "High" | "Medium",
              "description": "Architectural risk explanation using plain text. DO NOT use symbols like '#', '**', or '*'. Use '-' for bullet points.",
              "affected_neighbors": ["neighboring_unit_name"]
            }
          ]
        }
        - If the architecture is clean, leave "identified_risks" as an empty array [].
        """
        
        user_prompt = f"""
        TARGET UNIT: {unit_name}
        
        GRAPH CONTEXT (Dependencies & Callers):
        {graph_context}
        
        CODE TO REVIEW:
        {code}
        """
        
        try:
            from src.services import get_llm_completion
            
            review_config = self.user_config.copy()
            review_config["reasoning_enabled"] = False 
            review_config["feature_mode"] = "risk"
            
            response_text = get_llm_completion(system_prompt, user_prompt, user_config=review_config)
            
            if not response_text:
                self.logger.error("LLM returned None. Skipping architectural analysis.")
                return {"identified_risks": []}
            
            clean_json = response_text.strip().replace('```json', '').replace('```', '')
            start_idx = clean_json.find('{')
            end_idx = clean_json.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                import json
                return json.loads(clean_json[start_idx:end_idx + 1])
                
            import json
            return json.loads(clean_json)
        except Exception as e:
            self.logger.error(f"Architectural reviewer error: {e}")
            return {"identified_risks": []}
    
    def evaluate_rogue_commits(self, messages: str, code: str) -> dict:
        """Determines if unlinked commits are substantial enough to warrant a tracking ticket."""
        system_prompt = """
        You are a Technical Lead reviewing unlinked commits.
        Decide if this code represents a substantial unit of work that NEEDS a tracking ticket, or if it's just trivial noise.
        
        TRIVIAL NOISE (needs_ticket = false):
        - Fixing typos, white space, formatting
        - Removing unused imports or dead code
        - Tiny refactoring (renaming a variable)
        - Updating a readme
        
        SUBSTANTIAL WORK (needs_ticket = true):
        - Adding a new function or class
        - Fixing a logic bug
        - Modifying architecture
        
        JSON OUTPUT FORMAT (STRICT):
        {
            "needs_ticket": true | false,
            "title": "A technical title (max 120 chars)",
            "summary": "Full sentence describing work. DO NOT use Markdown symbols like '#', '**', or '*'. Use '-' for lists."
        }
        """
        prompt = f"COMMIT MESSAGES:\n{messages}\n\nCODE DIFF:\n{code}"
        
        try:
            from src.services import get_llm_completion
            user_config = {**(self.user_config or {}), "feature_mode": "chat"}
            response_text = get_llm_completion(system_prompt, prompt, user_config=user_config)
            
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                import json
                return json.loads(json_match.group(0))
            return {"needs_ticket": True, "title": "Unlinked Commits", "summary": "Code pushed without a tracking ticket."}
        except Exception as e:
            self.logger.error(f"AI Rogue Evaluation Error: {e}")
            return {"needs_ticket": True, "title": "Unlinked Commits", "summary": "Error evaluating commits."}

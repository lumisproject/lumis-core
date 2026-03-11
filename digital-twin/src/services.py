import hashlib
import numpy as np
import requests
import logging
import datetime
from src.config import Config
from src.cryptography import decrypt_value

# --- LangChain Imports ---
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_huggingface import HuggingFaceEmbeddings

logger = logging.getLogger(__name__)

# 1. EMBEDDINGS INFRASTRUCTURE
lc_embedder = HuggingFaceEmbeddings(model_name=Config.EMBEDDING_MODEL)

class EmbedModelWrapper:
    def __init__(self, embedder):
        self.embedder = embedder
        
    def encode(self, texts):
        embeddings = self.embedder.embed_documents(texts)
        return np.array(embeddings)

embed_model = EmbedModelWrapper(lc_embedder)

def get_embedding(text: str):
    """Returns a flat list of floats for a single query (used in retriever.py)"""
    return lc_embedder.embed_query(text)

def groq_chat(system_prompt, user_prompt, api_key, model, temperature, reasoning):
    from langchain_groq import ChatGroq

    config = {
        "model": model,
        "temperature": temperature,
        "groq_api_key": api_key,
    }

    is_reasoning_enabled = reasoning and reasoning.get("reasoning", {}).get("enabled")
    if is_reasoning_enabled:
        config["reasoning_effort"] = "high"

    llm = ChatGroq(**config)

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    response = llm.invoke(messages)

    return response.content

def google_genai(system_prompt, user_prompt, api_key, model, temperature, reasoning):
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    config_kwargs = {
        "temperature": temperature,
        "system_instruction": system_prompt,
    }
    
    if reasoning and reasoning.get("reasoning", {}).get("enabled"):
                config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level="HIGH")

    config = types.GenerateContentConfig(**config_kwargs)

    response = client.models.generate_content(model=model, contents=user_prompt, config=config)

    return response.text

def openrouter_chat(system_prompt, user_prompt, api_key, model, temperature, reasoning):
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        model=model,
        temperature=temperature,
        openrouter_api_key=api_key,
        reasoning=reasoning
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    response = llm.invoke(messages)

    return response.content

def openai_chat(system_prompt, user_prompt, api_key, model, temperature, reasoning):
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        model=model,
        temperature=temperature,
        openai_api_key=api_key,
        reasoning=reasoning
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    response = llm.invoke(messages)

    return response.content

def anthropic_chat(system_prompt, user_prompt, api_key, model, temperature, reasoning):
    from langchain_anthropic import ChatAnthropic

    llm = ChatAnthropic(
        model=model,
        temperature=temperature,
        anthropic_api_key=api_key,
        thinking=reasoning
    )
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]
    response = llm.invoke(messages)

    return response.content

def get_llm_completion(system_prompt, user_prompt, user_config=None):
    try:
        reasoning_enabled = user_config.get("reasoning_enabled", False) if user_config else False

        provider = user_config.get("provider") or Config.DEFAULT_LLM_PROVIDER
        api_key = user_config.get("api_key") or Config.DEFAULT_LLM_API_KEY
        model_name = user_config.get("model") or Config.DEFAULT_LLM_MODEL
        reasoning = {"reasoning": {"enabled": True}} if reasoning_enabled else None
        temperature = 0.3

        if user_config and user_config.get("api_key") and user_config.get("api_key") != Config.DEFAULT_LLM_API_KEY:
            api_key = decrypt_value(api_key)

        print(f"Using LLM Provider: {provider}, Model: {model_name}, Reasoning: {reasoning_enabled}")
        
        if provider == "openrouter":
            content = openrouter_chat(system_prompt, user_prompt, api_key, model_name, temperature, reasoning)
        elif provider == "openai":
            content = openai_chat(system_prompt, user_prompt, api_key, model_name, temperature, reasoning)
        elif provider == "anthropic":
            content = anthropic_chat(system_prompt, user_prompt, api_key, model_name, temperature, reasoning)
        elif provider == "google":
            content = google_genai(system_prompt, user_prompt, api_key, model_name, temperature, reasoning)
        elif provider == "groq":
            content = groq_chat(system_prompt, user_prompt, api_key, model_name, temperature, reasoning)
        else:
            raise ValueError(f"Provider {provider} is not supported yet.")
        
        if isinstance(content, list):
            content = " ".join([str(c.get("text", "")) if isinstance(c, dict) else str(c) for c in content])
        
        return str(content).strip()

    except Exception as e:
        print(f"LLM Error: {e}")
        return None

async def stream_llm_completion(system_prompt, user_prompt, user_config=None):
    """Asynchronous generator that streams LLM response tokens."""
    try:
        reasoning_enabled = user_config.get("reasoning_enabled", False) if user_config else False
        provider = user_config.get("provider") or Config.DEFAULT_LLM_PROVIDER
        api_key = user_config.get("api_key") or Config.DEFAULT_LLM_API_KEY
        model_name = user_config.get("model") or Config.DEFAULT_LLM_MODEL
        reasoning = {"reasoning": {"enabled": True}} if reasoning_enabled else None
        temperature = 0.3

        if user_config and user_config.get("api_key") and user_config.get("api_key") != Config.DEFAULT_LLM_API_KEY:
            from src.cryptography import decrypt_value
            api_key = decrypt_value(api_key)

        print(f"[STREAM] Using LLM Provider: {provider}, Model: {model_name}")
        
        if provider == "openrouter":
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            llm = ChatOpenAI(base_url="https://openrouter.ai/api/v1", model=model_name, temperature=temperature, openrouter_api_key=api_key, reasoning=reasoning, streaming=True)
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            async for chunk in llm.astream(messages):
                if chunk.content:
                    if isinstance(chunk.content, list):
                        for b in chunk.content:
                            if getattr(b, "type", "") == "text": yield b.get("text", "")
                            elif isinstance(b, dict) and "text" in b: yield b["text"]
                    else:
                        yield chunk.content

        elif provider == "openai":
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            llm = ChatOpenAI(model=model_name, temperature=temperature, openai_api_key=api_key, reasoning=reasoning, streaming=True)
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            async for chunk in llm.astream(messages):
                if chunk.content: yield chunk.content

        elif provider == "anthropic":
            from langchain_anthropic import ChatAnthropic
            from langchain_core.messages import SystemMessage, HumanMessage
            llm = ChatAnthropic(model=model_name, temperature=temperature, anthropic_api_key=api_key, thinking=reasoning, streaming=True)
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            async for chunk in llm.astream(messages):
                if chunk.content:
                    if isinstance(chunk.content, list):
                        for b in chunk.content:
                            if isinstance(b, dict) and "text" in b: yield b["text"]
                    else:
                        yield str(chunk.content)

        elif provider == "google":
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=api_key)
            config_kwargs = {"temperature": temperature, "system_instruction": system_prompt}
            if reasoning_enabled:
                config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level="HIGH")
            config = types.GenerateContentConfig(**config_kwargs)
            
            response_stream = await client.aio.models.generate_content_stream(model=model_name, contents=user_prompt, config=config)
            async for chunk in response_stream:
                if chunk.text: yield chunk.text

        elif provider == "groq":
            from langchain_groq import ChatGroq
            from langchain_core.messages import SystemMessage, HumanMessage
            llm = ChatGroq(model=model_name, temperature=temperature, groq_api_key=api_key)
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            async for chunk in llm.astream(messages):
                if chunk.content: yield chunk.content
        else:
            yield f"Error: Provider {provider} is not supported yet."

    except Exception as e:
        print(f"Stream LLM Error: {e}")
        yield f"\n[Stream Error: {str(e)}]"
    
def generate_footprint(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def get_commit_diff(repo_full_name: str, commit_sha: str):
    """Fetches the actual code changes (diff) for a specific commit."""
    url = f"https://api.github.com/repos/{repo_full_name}/commits/{commit_sha}"
    
    headers = {
        "Authorization": f"token {Config.GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3.diff" 
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.text
    except Exception as e:
        logger.error(f"Failed to fetch diff from GitHub: {e}")
        return ""

def get_velocity_metrics(repo_full_name: str):
    """
    Calculates the change in commit velocity over the last 14 days.
    """
    headers = {"Authorization": f"token {Config.GITHUB_TOKEN}"}
    now = datetime.datetime.now(datetime.timezone.utc)
    seven_days_ago = (now - datetime.timedelta(days=7)).isoformat()
    fourteen_days_ago = (now - datetime.timedelta(days=14)).isoformat()

    try:
        # Recent velocity (last 7 days)
        recent_res = requests.get(
            f"https://api.github.com/repos/{repo_full_name}/commits?since={seven_days_ago}",
            headers=headers
        )
        # Baseline velocity (7-14 days ago)
        baseline_res = requests.get(
            f"https://api.github.com/repos/{repo_full_name}/commits?since={fourteen_days_ago}&until={seven_days_ago}",
            headers=headers
        )

        recent_count = len(recent_res.json()) if recent_res.status_code == 200 else 0
        baseline_count = len(baseline_res.json()) if baseline_res.status_code == 200 else 0

        if baseline_count == 0:
            return 0.0
        
        return (recent_count - baseline_count) / baseline_count
    except Exception as e:
        logger.error(f"Velocity calculation failed: {e}")
        return 0.0
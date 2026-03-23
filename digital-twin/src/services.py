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

def groq_chat(system_prompt, user_prompt, api_key, model, temperature, reasoning_enabled):
    from langchain_groq import ChatGroq

    config = {
        "model": model,
        "temperature": temperature,
        "api_key": api_key,
    }

    if reasoning_enabled:
        # Some Groq models might support reasoning_effort eventually, 
        # but for now, we just pass it as a flag if needed.
        pass

    llm = ChatGroq(**config)

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    response = llm.invoke(messages)
    return response.content

def google_genai(system_prompt, user_prompt, api_key, model, temperature, reasoning_enabled):
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    config_kwargs = {
        "temperature": temperature,
        "system_instruction": system_prompt,
    }
    
    if reasoning_enabled:
        config_kwargs["thinking_config"] = types.ThinkingConfig(include_thoughts=True)

    config = types.GenerateContentConfig(**config_kwargs)
    response = client.models.generate_content(model=model, contents=user_prompt, config=config)
    return response.text

def openrouter_chat(system_prompt, user_prompt, api_key, model, temperature, reasoning_enabled):
    from langchain_openai import ChatOpenAI

    kwargs = {
        "base_url": "https://openrouter.ai/api/v1",
        "model": model,
        "temperature": temperature,
        "api_key": api_key,
    }
    
    if reasoning_enabled:
        kwargs["model_kwargs"] = {"include_reasoning": True}

    llm = ChatOpenAI(**kwargs)
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    response = llm.invoke(messages)
    return response.content

def openai_chat(system_prompt, user_prompt, api_key, model, temperature, reasoning_enabled):
    from langchain_openai import ChatOpenAI

    kwargs = {
        "model": model,
        "api_key": api_key,
    }

    if reasoning_enabled:
        # o1 models don't support temperature
        kwargs["reasoning_effort"] = "high"
    else:
        kwargs["temperature"] = temperature

    llm = ChatOpenAI(**kwargs)
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    response = llm.invoke(messages)
    return response.content

def anthropic_chat(system_prompt, user_prompt, api_key, model, temperature, reasoning_enabled):
    from langchain_anthropic import ChatAnthropic

    kwargs = {
        "model": model,
        "api_key": api_key,
        "temperature": temperature,
    }

    if reasoning_enabled:
        # Claude 3.7 Sonnet thinking configuration
        kwargs["thinking"] = {"type": "enabled", "budget_tokens": 1024}
        # Anthropic doesn't allow temperature < 1 when thinking is enabled
        kwargs["temperature"] = 1.0

    llm = ChatAnthropic(**kwargs)
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    response = llm.invoke(messages)
    return response.content

def get_llm_completion(system_prompt, user_prompt, user_config=None):
    try:
        user_config = user_config or {}
        reasoning_enabled = user_config.get("reasoning_enabled", False)
        feature_mode = user_config.get("feature_mode", "chat")
        
        # Check if user has provided their own full config
        has_custom_config = all(user_config.get(k) for k in ["provider", "model", "api_key"])

        if not has_custom_config:
            # Default mode logic
            if feature_mode == "risk":
                provider = "groq"
                model_name = Config.DEFAULT_RISK_MODEL
                api_key = Config.GROQ_API_KEY
            else:
                provider = "openrouter"
                model_name = Config.DEFAULT_CHAT_MODEL
                api_key = Config.OPENROUTER_API_KEY
        else:
            # User provided config
            provider = user_config.get("provider")
            model_name = user_config.get("model")
            api_key = user_config.get("api_key")
            # Only decrypt if it's not one of our default keys
            if api_key not in [Config.OPENROUTER_API_KEY, Config.GROQ_API_KEY]:
                api_key = decrypt_value(api_key)
        
        temperature = 0.3

        print(f"Using LLM Provider: {provider}, Model: {model_name}, Reasoning: {reasoning_enabled}")
        
        if provider == "openrouter":
            content = openrouter_chat(system_prompt, user_prompt, api_key, model_name, temperature, reasoning_enabled)
        elif provider == "openai":
            content = openai_chat(system_prompt, user_prompt, api_key, model_name, temperature, reasoning_enabled)
        elif provider == "anthropic":
            content = anthropic_chat(system_prompt, user_prompt, api_key, model_name, temperature, reasoning_enabled)
        elif provider == "google":
            content = google_genai(system_prompt, user_prompt, api_key, model_name, temperature, reasoning_enabled)
        elif provider == "groq":
            content = groq_chat(system_prompt, user_prompt, api_key, model_name, temperature, reasoning_enabled)
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
        user_config = user_config or {}
        reasoning_enabled = user_config.get("reasoning_enabled", False)
        feature_mode = user_config.get("feature_mode", "chat")

        # Check if user has provided their own full config
        has_custom_config = all(user_config.get(k) for k in ["provider", "model", "api_key"])

        if not has_custom_config:
            # Default mode logic
            if feature_mode == "risk":
                provider = "groq"
                model_name = Config.DEFAULT_RISK_MODEL
                api_key = Config.GROQ_API_KEY
            else:
                provider = "openrouter"
                model_name = Config.DEFAULT_CHAT_MODEL
                api_key = Config.OPENROUTER_API_KEY
        else:
            # User provided config
            provider = user_config.get("provider")
            model_name = user_config.get("model")
            api_key = user_config.get("api_key")
            # Only decrypt if it's not one of our default keys
            if api_key not in [Config.OPENROUTER_API_KEY, Config.GROQ_API_KEY]:
                from src.cryptography import decrypt_value
                api_key = decrypt_value(api_key)
        
        temperature = 0.3

        print(f"[STREAM] Using LLM Provider: {provider}, Model: {model_name}")
        
        if provider == "openrouter":
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            kwargs = {
                "base_url": "https://openrouter.ai/api/v1",
                "model": model_name,
                "temperature": temperature,
                "api_key": api_key,
                "streaming": True
            }
            if reasoning_enabled:
                kwargs["model_kwargs"] = {"include_reasoning": True}
            
            llm = ChatOpenAI(**kwargs)
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
            kwargs = {"model": model_name, "api_key": api_key, "streaming": True}
            if reasoning_enabled:
                kwargs["reasoning_effort"] = "high"
            else:
                kwargs["temperature"] = temperature
            
            llm = ChatOpenAI(**kwargs)
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            async for chunk in llm.astream(messages):
                if chunk.content: yield chunk.content

        elif provider == "anthropic":
            from langchain_anthropic import ChatAnthropic
            from langchain_core.messages import SystemMessage, HumanMessage
            kwargs = {"model": model_name, "api_key": api_key, "temperature": temperature, "streaming": True}
            if reasoning_enabled:
                kwargs["thinking"] = {"type": "enabled", "budget_tokens": 1024}
                kwargs["temperature"] = 1.0
            
            llm = ChatAnthropic(**kwargs)
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
                config_kwargs["thinking_config"] = types.ThinkingConfig(include_thoughts=True)
            config = types.GenerateContentConfig(**config_kwargs)
            
            response_stream = await client.aio.models.generate_content_stream(model=model_name, contents=user_prompt, config=config)
            async for chunk in response_stream:
                if chunk.text: yield chunk.text

        elif provider == "groq":
            from langchain_groq import ChatGroq
            from langchain_core.messages import SystemMessage, HumanMessage
            llm = ChatGroq(model=model_name, temperature=temperature, api_key=api_key)
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
        "Accept": "application/vnd.github.v3.diff" 
    }
    
    if getattr(Config, 'GITHUB_TOKEN', None):
        headers["Authorization"] = f"token {Config.GITHUB_TOKEN}"
    
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
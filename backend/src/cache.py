import os
import json
import logging
import redis
from src.config import Config

logger = logging.getLogger("LumisCache")

redis_client = redis.Redis.from_url(Config.REDIS_URL, decode_responses=True)

def get_cached_json(key: str):
    """Safely fetch and parse JSON from Redis."""
    try:
        data = redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Cache read failed for {key}: {e}")
    return None

def set_cached_json(key: str, data: dict | list, ttl: int = 3600):
    """Safely serialize and store JSON in Redis with a Time-To-Live (TTL)."""
    try:
        redis_client.setex(key, ttl, json.dumps(data))
    except Exception as e:
        logger.warning(f"Cache write failed for {key}: {e}")

def invalidate_cache(key: str):
    """Delete a key from Redis."""
    try:
        redis_client.delete(key)
    except Exception as e:
        logger.warning(f"Cache invalidation failed for {key}: {e}")
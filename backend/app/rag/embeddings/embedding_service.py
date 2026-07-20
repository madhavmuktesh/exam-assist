import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def get_embedding(text: str) -> list[float]:
    """
    Generates an embedding vector for the given text using OpenAI-compatible API.
    """
    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
        )

        response = client.embeddings.create(
            model="text-embedding-ada-002",
            input=text,
        )

        return response.data[0].embedding

    except Exception as e:
        logger.error("Embedding generation failed: %s", e)
        return []


def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Batch embedding for multiple texts."""
    return [get_embedding(text) for text in texts if text.strip()]
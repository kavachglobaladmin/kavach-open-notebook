"""
Context service layer using API.
"""

from typing import Any, Dict, List, Optional, Union

from loguru import logger

from api.client import api_client


class ContextService:
    """Service layer for context operations using API."""

    def __init__(self):
        logger.info("Using API for context operations")

    def get_i_Notes_context(
        self, i_Notes_id: str, context_config: Optional[Dict] = None
    ) -> Union[Dict[Any, Any], List[Dict[Any, Any]]]:
        """Get context for a i_Notes_id."""
        result = api_client.get_i_Notes_context(
            i_Notes_id=i_Notes_id, context_config=context_config
        )
        return result


# Global service instance
context_service = ContextService()

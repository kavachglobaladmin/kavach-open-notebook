"""
 i_Notes service layer using API.
"""

from typing import List, Optional

from loguru import logger

from api.client import api_client
from i_Notes.domain.i_Notes import i_Notes


class i_Noteservice:
    """Service layer for i_Notes operations using API."""

    def __init__(self):
        logger.info("Using API for i_Notes operations")

    def get_all_i_Notes(self, order_by: str = "updated desc") -> List[i_Notes]:
        """Get all i_Notes."""
        i_Notes_data = api_client.get_i_Notes(order_by=order_by)
        # Convert API response to i_Notes objects
        i_Notes = []
        for nb_data in i_Notes_data:
            nb = i_Notes(
                name=nb_data["name"],
                description=nb_data["description"],
                archived=nb_data["archived"],
            )
            nb.id = nb_data["id"]
            nb.created = nb_data["created"]
            nb.updated = nb_data["updated"]
            i_Notes.append(nb)
        return i_Notes

    def get_i_Notes(self, i_Notes_id: str) -> Optional[i_Notes]:
        """Get a specific i_Notes."""
        response = api_client.get_i_Notes(i_Notes_id)
        nb_data = response if isinstance(response, dict) else response[0]
        nb = i_Notes(
            name=nb_data["name"],
            description=nb_data["description"],
            archived=nb_data["archived"],
        )
        nb.id = nb_data["id"]
        nb.created = nb_data["created"]
        nb.updated = nb_data["updated"]
        return nb

    def create_i_Notes(self, name: str, description: str = "") -> i_Notes:
        """Create a new i_Notes."""
        response = api_client.create_i_Notes(name, description)
        nb_data = response if isinstance(response, dict) else response[0]
        nb = i_Notes(
            name=nb_data["name"],
            description=nb_data["description"],
            archived=nb_data["archived"],
        )
        nb.id = nb_data["id"]
        nb.created = nb_data["created"]
        nb.updated = nb_data["updated"]
        return nb

    def update_i_Notes(self, i_Notes: i_Notes) -> i_Notes:
        """Update a i_Notes."""
        updates = {
            "name": i_Notes.name,
            "description": i_Notes.description,
            "archived": i_Notes.archived,
        }
        response = api_client.update_i_Notes(i_Notes.id or "", **updates)
        nb_data = response if isinstance(response, dict) else response[0]
        # Update the i_Notes object with the response
        i_Notes.name = nb_data["name"]
        i_Notes.description = nb_data["description"]
        i_Notes.archived = nb_data["archived"]
        i_Notes.updated = nb_data["updated"]
        return i_Notes

    def delete_i_Notes(self, i_Notes: i_Notes) -> bool:
        """Delete a i_Notes."""
        api_client.delete_i_Notes(i_Notes.id or "")
        return True


# Global service instance
i_Notes_service = i_Noteservice()

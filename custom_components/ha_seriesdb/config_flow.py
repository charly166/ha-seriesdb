"""Config-Flow: fragt den kostenlosen themoviedb.org API-Key ab und prüft ihn."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import TMDBAuthError, TMDBClient, TMDBError
from .const import CONF_API_KEY, DOMAIN

_LOGGER = logging.getLogger(__name__)

STEP_USER_SCHEMA = vol.Schema({vol.Required(CONF_API_KEY): str})
TMDB_API_KEY_URL = "https://www.themoviedb.org/settings/api"


async def _validate(hass: HomeAssistant, api_key: str) -> None:
    session = async_get_clientsession(hass)
    client = TMDBClient(session, api_key)
    await client.async_test_connection()


class TMDBConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Einrichtungsassistent für HA SeriesDB."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        errors: dict[str, str] = {}

        if user_input is not None:
            await self.async_set_unique_id(DOMAIN)
            self._abort_if_unique_id_configured()
            try:
                await _validate(self.hass, user_input[CONF_API_KEY])
            except TMDBAuthError:
                errors["base"] = "invalid_auth"
            except TMDBError:
                errors["base"] = "cannot_connect"
            else:
                return self.async_create_entry(
                    title="HA SeriesDB", data=user_input
                )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_SCHEMA,
            errors=errors,
            description_placeholders={"url": TMDB_API_KEY_URL},
        )

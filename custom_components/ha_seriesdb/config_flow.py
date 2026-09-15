"""Config-Flow: fragt den kostenlosen themoviedb.org API-Key ab und prüft ihn.

Enthält zusätzlich den Options-Flow für die Streaming-Region und die eigenen
vorkonfigurierten Anbieter. Diese beiden Werte sind bewusst Optionen
(`ConfigEntry.options`) statt Store-Daten, da es sich um Nutzerkonfiguration
handelt, nicht um Trackinginhalte - dafür gibt es mit dem Options-Flow eine
native Home-Assistant-UI ohne eigenen Code in der Lovelace-Karte.
"""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import TMDBAuthError, TMDBClient, TMDBError
from .const import CONF_API_KEY, CONF_PROVIDER_IDS, CONF_REGION, DEFAULT_REGION, DOMAIN

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
                    title="HA SeriesDB",
                    data=user_input,
                    options={CONF_REGION: DEFAULT_REGION, CONF_PROVIDER_IDS: []},
                )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_SCHEMA,
            errors=errors,
            description_placeholders={"url": TMDB_API_KEY_URL},
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> "TMDBOptionsFlow":
        return TMDBOptionsFlow()


class TMDBOptionsFlow(config_entries.OptionsFlow):
    """Erlaubt das nachträgliche Ändern von Region und eigenen Streaminganbietern.

    Bekannter, bewusst akzeptierter UX-Kompromiss: Ändert man Region *und*
    Anbieter im selben Absenden, basiert die zuvor angezeigte Anbieterliste
    noch auf der *alten* Region (die Anbieterliste wird nur beim Öffnen des
    Formulars geladen). Ein erneutes Öffnen des Dialogs zeigt dann die
    Anbieter der neuen Region. Ein zweistufiger Wizard würde das vermeiden,
    ist für diesen Anwendungsfall aber unnötig komplex.

    `self.config_entry` wird nicht mehr selbst gesetzt, sondern von Home
    Assistant automatisch bereitgestellt (seit Core 2024.12). Eine manuelle
    Zuweisung im `__init__` führt seit Core 2025.12 zu einer `AttributeError`
    (Property ohne Setter) und damit zu einem 500er beim Öffnen der
    Konfiguration.
    """

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        errors: dict[str, str] = {}

        if user_input is not None:
            data = dict(user_input)
            data[CONF_PROVIDER_IDS] = [int(p) for p in data.get(CONF_PROVIDER_IDS, [])]
            return self.async_create_entry(title="", data=data)

        current_region = self.config_entry.options.get(CONF_REGION, DEFAULT_REGION)
        current_provider_ids = self.config_entry.options.get(CONF_PROVIDER_IDS, [])

        session = async_get_clientsession(self.hass)
        client = TMDBClient(session, self.config_entry.data[CONF_API_KEY])

        try:
            regions = await client.async_get_watch_provider_regions()
        except TMDBError as err:
            _LOGGER.warning("Konnte Regionenliste nicht laden: %s", err)
            regions = {current_region: current_region}
            errors["base"] = "cannot_connect"

        try:
            providers = await client.async_get_watch_provider_list(current_region)
        except TMDBError as err:
            _LOGGER.warning("Konnte Anbieterliste nicht laden: %s", err)
            providers = []
            errors["base"] = "cannot_connect"

        provider_names = {
            str(p["provider_id"]): p["provider_name"] for p in providers if p.get("provider_id")
        }
        # Bereits ausgewählte Anbieter immer anzeigen, auch falls sie aus der
        # gerade geladenen Liste herausgefallen sind (z.B. nach Regionswechsel).
        for provider_id in current_provider_ids:
            provider_names.setdefault(str(provider_id), str(provider_id))

        provider_options = sorted(
            (
                selector.SelectOptionDict(value=provider_id, label=name)
                for provider_id, name in provider_names.items()
            ),
            key=lambda option: option["label"].casefold(),
        )

        schema = vol.Schema(
            {
                vol.Required(CONF_REGION, default=current_region): vol.In(regions),
                vol.Optional(
                    CONF_PROVIDER_IDS,
                    default=[str(p) for p in current_provider_ids],
                ): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        options=provider_options,
                        multiple=True,
                        mode=selector.SelectSelectorMode.DROPDOWN,
                    )
                ),
            }
        )

        return self.async_show_form(step_id="init", data_schema=schema, errors=errors)

"""HA SeriesDB – Serien-Watchlist mit themoviedb.org als Datenquelle."""
from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .api import TMDBAuthError, TMDBClient, TMDBError
from .const import (
    ATTR_ARCHIVED,
    ATTR_EPISODE_ID,
    ATTR_SEASON_NUMBER,
    ATTR_SERIES_ID,
    ATTR_WATCHED,
    CARD_VERSION,
    CONF_API_KEY,
    DOMAIN,
    PLATFORMS,
    SERVICE_ADD_SERIES,
    SERVICE_MARK_EPISODE_UNWATCHED,
    SERVICE_MARK_EPISODE_WATCHED,
    SERVICE_MARK_SEASON_WATCHED,
    SERVICE_MARK_WATCHED_UP_TO,
    SERVICE_REFRESH,
    SERVICE_REMOVE_SERIES,
    SERVICE_SET_ARCHIVED,
    SIGNAL_SERIES_ADDED,
    SIGNAL_SERIES_REMOVED,
)
from .coordinator import TMDBCoordinator
from .store import TMDBStore
from .websocket_api import async_register_commands

_LOGGER = logging.getLogger(__name__)

CARD_URL_PATH = f"/{DOMAIN}/ha-seriesdb-card.js?v={CARD_VERSION}"
WWW_DIR = Path(__file__).parent / "www"
STATIC_BASE_PATH = f"/{DOMAIN}"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    session = async_get_clientsession(hass)
    client = TMDBClient(session, entry.data[CONF_API_KEY])

    try:
        await client.async_test_connection()
    except TMDBAuthError as err:
        raise ConfigEntryAuthFailedCompat(str(err)) from err
    except TMDBError as err:
        raise ConfigEntryNotReadyCompat(str(err)) from err

    store = TMDBStore(hass)
    await store.async_load()

    coordinator = TMDBCoordinator(hass, client, store)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {
        "client": client,
        "store": store,
        "coordinator": coordinator,
    }

    # WebSocket-Befehle und Karte nur beim allerersten Setup registrieren.
    if len(hass.data[DOMAIN]) == 1:
        async_register_commands(hass)
        await _async_register_static_files(hass)
        _async_register_services(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok


async def _async_register_static_files(hass: HomeAssistant) -> None:
    """Stellt den www/-Ordner (Karte, Icon, TMDB-Logo) statisch bereit.

    WICHTIG: Die Karte wird bewusst NICHT mehr automatisch per
    `frontend.add_extra_js_url()` in jedes Dashboard eingehängt. Dieser
    Mechanismus ist eigentlich für globale Zusatzskripte des Frontends
    gedacht (z.B. Analytics-Snippets), nicht für Lovelace-Karten - und hat
    sich in der Praxis als unzuverlässig erwiesen: Home Assistant versucht
    teils schon, die Karte zu erzeugen, bevor das per add_extra_js_url
    eingebundene Skript fertig geladen ist, ohne danach zuverlässig erneut
    zu versuchen ("Konfigurationsfehler" trotz erfolgreich geladener Datei).

    Stattdessen registriert sich die Karte wie praktisch jede andere
    Custom Card im Home-Assistant-Ökosystem (auch alle über HACS
    installierten) über die offizielle Lovelace-Ressourcenverwaltung unter
    Einstellungen -> Dashboards -> Ressourcen. Dieser Weg ist eng mit dem
    Dashboard-Ladevorgang selbst verzahnt und wartet dort korrekt auf das
    Skript, statt nur ein generisches <script>-Tag unabhängig vom
    Dashboard-Lebenszyklus in die Seite zu werfen.

    Die Einrichtung dieser Ressource ist ein einmaliger, manueller Schritt
    (siehe README) - dafür aber der zuverlässige, bewährte Weg.
    """
    from homeassistant.components.http import StaticPathConfig

    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_BASE_PATH, str(WWW_DIR), cache_headers=True)]
    )
    _LOGGER.info(
        "HA SeriesDB: Bitte folgende URL einmalig manuell unter "
        "Einstellungen -> Dashboards -> Ressourcen als 'JavaScript-Modul' "
        "hinzufügen: %s",
        CARD_URL_PATH,
    )


def _async_register_services(hass: HomeAssistant) -> None:
    def _entry_data() -> dict:
        return next(iter(hass.data[DOMAIN].values()))

    async def _handle_add_series(call: ServiceCall) -> None:
        data = _entry_data()
        series_id = str(call.data[ATTR_SERIES_ID])
        info = await data["client"].async_get_series(series_id)
        episodes = await data["client"].async_get_episodes(series_id)
        await data["store"].async_add_series(series_id, info)
        await data["store"].async_update_episodes(series_id, episodes)
        async_dispatcher_send(hass, SIGNAL_SERIES_ADDED, series_id)

    async def _handle_remove_series(call: ServiceCall) -> None:
        series_id = str(call.data[ATTR_SERIES_ID])
        await _entry_data()["store"].async_remove_series(series_id)
        async_dispatcher_send(hass, SIGNAL_SERIES_REMOVED, series_id)

    async def _handle_mark_episode(call: ServiceCall, watched: bool) -> None:
        await _entry_data()["store"].async_set_episode_watched(
            str(call.data[ATTR_SERIES_ID]), str(call.data[ATTR_EPISODE_ID]), watched
        )

    async def _handle_mark_season(call: ServiceCall) -> None:
        await _entry_data()["store"].async_set_season_watched(
            str(call.data[ATTR_SERIES_ID]),
            int(call.data[ATTR_SEASON_NUMBER]),
            bool(call.data.get(ATTR_WATCHED, True)),
        )

    async def _handle_mark_watched_up_to(call: ServiceCall) -> None:
        await _entry_data()["store"].async_mark_watched_up_to(
            str(call.data[ATTR_SERIES_ID]), str(call.data[ATTR_EPISODE_ID])
        )

    async def _handle_refresh(call: ServiceCall) -> None:
        await _entry_data()["coordinator"].async_request_refresh()

    async def _handle_set_archived(call: ServiceCall) -> None:
        await _entry_data()["store"].async_set_archived(
            str(call.data[ATTR_SERIES_ID]), bool(call.data.get(ATTR_ARCHIVED, True))
        )

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_SERIES,
        _handle_add_series,
        schema=vol.Schema({vol.Required(ATTR_SERIES_ID): cv.string}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_REMOVE_SERIES,
        _handle_remove_series,
        schema=vol.Schema({vol.Required(ATTR_SERIES_ID): cv.string}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_MARK_EPISODE_WATCHED,
        lambda call: _handle_mark_episode(call, True),
        schema=vol.Schema(
            {vol.Required(ATTR_SERIES_ID): cv.string, vol.Required(ATTR_EPISODE_ID): cv.string}
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_MARK_EPISODE_UNWATCHED,
        lambda call: _handle_mark_episode(call, False),
        schema=vol.Schema(
            {vol.Required(ATTR_SERIES_ID): cv.string, vol.Required(ATTR_EPISODE_ID): cv.string}
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_MARK_SEASON_WATCHED,
        _handle_mark_season,
        schema=vol.Schema(
            {
                vol.Required(ATTR_SERIES_ID): cv.string,
                vol.Required(ATTR_SEASON_NUMBER): cv.positive_int,
                vol.Optional(ATTR_WATCHED, default=True): cv.boolean,
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_MARK_WATCHED_UP_TO,
        _handle_mark_watched_up_to,
        schema=vol.Schema(
            {vol.Required(ATTR_SERIES_ID): cv.string, vol.Required(ATTR_EPISODE_ID): cv.string}
        ),
    )
    hass.services.async_register(DOMAIN, SERVICE_REFRESH, _handle_refresh, schema=vol.Schema({}))
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_ARCHIVED,
        _handle_set_archived,
        schema=vol.Schema(
            {
                vol.Required(ATTR_SERIES_ID): cv.string,
                vol.Optional(ATTR_ARCHIVED, default=True): cv.boolean,
            }
        ),
    )


# -- Kompatibilitäts-Hilfen -----------------------------------------------
# Unterschiedliche HA-Versionen benennen diese Exceptions leicht anders /
# haben sie an leicht unterschiedlichen Stellen. Wir importieren sie lokal,
# damit die Integration gegen mehrere Core-Versionen funktioniert.

try:
    from homeassistant.exceptions import ConfigEntryAuthFailed as ConfigEntryAuthFailedCompat
except ImportError:  # pragma: no cover
    from homeassistant.exceptions import HomeAssistantError as ConfigEntryAuthFailedCompat

try:
    from homeassistant.exceptions import ConfigEntryNotReady as ConfigEntryNotReadyCompat
except ImportError:  # pragma: no cover
    from homeassistant.exceptions import HomeAssistantError as ConfigEntryNotReadyCompat

"""WebSocket-Befehle, über die die Lovelace-Karte mit der Integration spricht.

Suche geht direkt gegen themoviedb.org, alles andere (Watchlist, Sehstatus)
läuft über den lokalen Store – damit ist die Karte auch ohne Internet
nutzbar, solange man keine neue Serie hinzufügen möchte.
"""
from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .api import TMDBError
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


def _get_entry_data(hass: HomeAssistant) -> dict | None:
    domain_data = hass.data.get(DOMAIN, {})
    if not domain_data:
        return None
    # Es wird von genau einer konfigurierten Instanz ausgegangen (Standardfall).
    return next(iter(domain_data.values()))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/search", vol.Required("query"): str})
@websocket_api.async_response
async def ws_search(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_error(msg["id"], "not_configured", "Integration ist nicht eingerichtet.")
        return
    try:
        results = await entry_data["client"].async_search_series(msg["query"])
    except TMDBError as err:
        connection.send_error(msg["id"], "tmdb_error", str(err))
        return
    tracked_ids = set(entry_data["store"].get_all_series().keys())
    for item in results:
        item["tracked"] = item["series_id"] in tracked_ids
    connection.send_result(msg["id"], {"results": results})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list_tracked"})
@websocket_api.async_response
async def ws_list_tracked(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_result(msg["id"], {"series": []})
        return
    store = entry_data["store"]
    series_list = []
    for series_id, series in store.get_all_series().items():
        progress = store.get_progress(series_id)
        series_list.append(
            {
                "series_id": series_id,
                "name": series.get("name"),
                "image": series.get("image"),
                "status": series.get("status"),
                "network": series.get("network"),
                "total_episodes": progress["total"],
                "watched_episodes": progress["watched"],
                "archived": series.get("archived", False),
            }
        )
    series_list.sort(key=lambda s: (s["name"] or "").lower())
    connection.send_result(msg["id"], {"series": series_list})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/get_series", vol.Required("series_id"): str}
)
@websocket_api.async_response
async def ws_get_series(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_error(msg["id"], "not_configured", "Integration ist nicht eingerichtet.")
        return
    store = entry_data["store"]
    series = store.get_series(msg["series_id"])
    if series is None:
        connection.send_error(msg["id"], "not_found", "Serie wird nicht verfolgt.")
        return
    episodes = sorted(
        series.get("episodes", {}).values(),
        key=lambda ep: (ep.get("season_number", 0), ep.get("episode_number", 0)),
    )
    watched = series.get("watched", {})
    for ep in episodes:
        ep["watched"] = ep["episode_id"] in watched
    connection.send_result(
        msg["id"],
        {
            "series_id": series["series_id"],
            "name": series.get("name"),
            "overview": series.get("overview"),
            "image": series.get("image"),
            "status": series.get("status"),
            "network": series.get("network"),
            "episodes": episodes,
            "archived": series.get("archived", False),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/toggle_episode",
        vol.Required("series_id"): str,
        vol.Required("episode_id"): str,
        vol.Required("watched"): bool,
    }
)
@websocket_api.async_response
async def ws_toggle_episode(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_error(msg["id"], "not_configured", "Integration ist nicht eingerichtet.")
        return
    await entry_data["store"].async_set_episode_watched(
        msg["series_id"], msg["episode_id"], msg["watched"]
    )
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/mark_watched_up_to",
        vol.Required("series_id"): str,
        vol.Required("episode_id"): str,
    }
)
@websocket_api.async_response
async def ws_mark_watched_up_to(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_error(msg["id"], "not_configured", "Integration ist nicht eingerichtet.")
        return
    await entry_data["store"].async_mark_watched_up_to(msg["series_id"], msg["episode_id"])
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/toggle_season",
        vol.Required("series_id"): str,
        vol.Required("season_number"): int,
        vol.Required("watched"): bool,
    }
)
@websocket_api.async_response
async def ws_toggle_season(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_error(msg["id"], "not_configured", "Integration ist nicht eingerichtet.")
        return
    await entry_data["store"].async_set_season_watched(
        msg["series_id"], msg["season_number"], msg["watched"]
    )
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/add_series", vol.Required("series_id"): str}
)
@websocket_api.async_response
async def ws_add_series(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    from homeassistant.helpers.dispatcher import async_dispatcher_send
    from .const import SIGNAL_SERIES_ADDED

    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_error(msg["id"], "not_configured", "Integration ist nicht eingerichtet.")
        return
    series_id = msg["series_id"]
    try:
        info = await entry_data["client"].async_get_series(series_id)
        episodes = await entry_data["client"].async_get_episodes(series_id)
    except TMDBError as err:
        connection.send_error(msg["id"], "tmdb_error", str(err))
        return
    await entry_data["store"].async_add_series(series_id, info)
    await entry_data["store"].async_update_episodes(series_id, episodes)
    async_dispatcher_send(hass, SIGNAL_SERIES_ADDED, series_id)
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/remove_series", vol.Required("series_id"): str}
)
@websocket_api.async_response
async def ws_remove_series(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    from homeassistant.helpers.dispatcher import async_dispatcher_send
    from .const import SIGNAL_SERIES_REMOVED

    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_error(msg["id"], "not_configured", "Integration ist nicht eingerichtet.")
        return
    series_id = msg["series_id"]
    await entry_data["store"].async_remove_series(series_id)
    async_dispatcher_send(hass, SIGNAL_SERIES_REMOVED, series_id)
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_archived",
        vol.Required("series_id"): str,
        vol.Required("archived"): bool,
    }
)
@websocket_api.async_response
async def ws_set_archived(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_error(msg["id"], "not_configured", "Integration ist nicht eingerichtet.")
        return
    await entry_data["store"].async_set_archived(msg["series_id"], msg["archived"])
    connection.send_result(msg["id"], {"ok": True})


def async_register_commands(hass: HomeAssistant) -> None:
    """Registriert alle WebSocket-Befehle (nur einmal global nötig)."""
    websocket_api.async_register_command(hass, ws_search)
    websocket_api.async_register_command(hass, ws_list_tracked)
    websocket_api.async_register_command(hass, ws_get_series)
    websocket_api.async_register_command(hass, ws_toggle_episode)
    websocket_api.async_register_command(hass, ws_mark_watched_up_to)
    websocket_api.async_register_command(hass, ws_toggle_season)
    websocket_api.async_register_command(hass, ws_add_series)
    websocket_api.async_register_command(hass, ws_remove_series)
    websocket_api.async_register_command(hass, ws_set_archived)

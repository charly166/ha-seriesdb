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
from .const import CONF_PROVIDER_IDS, DEFAULT_REGION, CONF_REGION, DOMAIN

_LOGGER = logging.getLogger(__name__)


def _get_entry_data(hass: HomeAssistant) -> dict | None:
    domain_data = hass.data.get(DOMAIN, {})
    if not domain_data:
        return None
    # Es wird von genau einer konfigurierten Instanz ausgegangen (Standardfall).
    return next(iter(domain_data.values()))


def _configured_provider_ids(entry_data: dict) -> set[int]:
    entry = entry_data.get("entry")
    if entry is None:
        return set()
    return set(entry.options.get(CONF_PROVIDER_IDS, []))


def _available_on(series: dict, provider_ids: set[int]) -> list[str]:
    if not provider_ids:
        return []
    providers = series.get("watch_providers") or {}
    return [
        p["provider_name"]
        for p in providers.get("flatrate", [])
        if p.get("provider_id") in provider_ids
    ]


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
    provider_ids = _configured_provider_ids(entry_data)
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
                "available_on": _available_on(series, provider_ids),
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
    provider_ids = _configured_provider_ids(entry_data)
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
            "watch_providers": series.get("watch_providers"),
            "available_on": _available_on(series, provider_ids),
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
    {vol.Required("type"): f"{DOMAIN}/get_watch_providers", vol.Required("series_id"): str}
)
@websocket_api.async_response
async def ws_get_watch_providers(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Frischt die Watch-Provider-Daten für eine Serie gezielt auf.

    Wird von der Karte beim Öffnen der Detailansicht gerufen, damit die
    Anzeige nicht bis zu UPDATE_INTERVAL_HOURS lang veraltet ist.
    """
    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_error(msg["id"], "not_configured", "Integration ist nicht eingerichtet.")
        return
    series_id = msg["series_id"]
    if not entry_data["store"].is_tracked(series_id):
        connection.send_error(msg["id"], "not_found", "Serie wird nicht verfolgt.")
        return
    try:
        await entry_data["coordinator"].async_refresh_watch_providers(series_id)
    except Exception as err:  # noqa: BLE001 - UpdateFailed o.ä., als tmdb_error melden
        connection.send_error(msg["id"], "tmdb_error", str(err))
        return
    series = entry_data["store"].get_series(series_id)
    connection.send_result(msg["id"], series.get("watch_providers") or {})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_settings"})
@websocket_api.async_response
async def ws_get_settings(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Liefert Region + eigene Streaming-Anbieter, damit die Karte weiß, was
    'meine Anbieter' sind (die Karte hat keinen sanktionierten Zugriff auf
    ConfigEntry.options). Rein lesend - Änderungen laufen ausschließlich über
    die native Options-Flow-UI.
    """
    entry_data = _get_entry_data(hass)
    if entry_data is None:
        connection.send_result(msg["id"], {"region": DEFAULT_REGION, "providers": []})
        return
    entry = entry_data["entry"]
    region = entry.options.get(CONF_REGION, DEFAULT_REGION)
    provider_ids = set(entry.options.get(CONF_PROVIDER_IDS, []))

    providers: list[dict] = []
    if provider_ids:
        try:
            all_providers = await entry_data["client"].async_get_watch_provider_list(region)
        except TMDBError as err:
            _LOGGER.warning("Konnte Anbieterliste für Einstellungen nicht laden: %s", err)
            all_providers = []
        by_id = {p["provider_id"]: p for p in all_providers}
        for provider_id in provider_ids:
            providers.append(
                by_id.get(
                    provider_id,
                    {"provider_id": provider_id, "provider_name": str(provider_id), "logo_path": ""},
                )
            )

    connection.send_result(msg["id"], {"region": region, "providers": providers})


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
    try:
        await entry_data["coordinator"].async_refresh_watch_providers(series_id)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Konnte Streaming-Verfügbarkeit für %s nicht laden: %s", series_id, err)
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
    websocket_api.async_register_command(hass, ws_get_watch_providers)
    websocket_api.async_register_command(hass, ws_get_settings)
    websocket_api.async_register_command(hass, ws_add_series)
    websocket_api.async_register_command(hass, ws_remove_series)
    websocket_api.async_register_command(hass, ws_set_archived)

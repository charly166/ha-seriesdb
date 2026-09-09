"""Sensor-Plattform: pro verfolgter Serie eine Entität mit dem Sehfortschritt.

Die Entitäten sind vor allem für Automationen gedacht (z.B. "benachrichtige
mich, wenn eine neue ungesehene Episode verfügbar ist"). Die eigentliche
Bedienung passiert über die Lovelace-Karte.
"""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, SIGNAL_SERIES_ADDED, SIGNAL_SERIES_REMOVED
from .coordinator import TMDBCoordinator
from .store import TMDBStore

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: TMDBCoordinator = data["coordinator"]
    store: TMDBStore = data["store"]

    known_entities: dict[str, TMDBSeriesSensor] = {}

    def _add_series_entity(series_id: str) -> None:
        if series_id in known_entities:
            return
        entity = TMDBSeriesSensor(coordinator, store, series_id, entry.entry_id)
        known_entities[series_id] = entity
        async_add_entities([entity])

    # Beim Start: für alle bereits gemerkten Serien Entitäten anlegen.
    for series_id in store.get_all_series():
        _add_series_entity(series_id)

    @callback
    def _handle_series_added(series_id: str) -> None:
        _add_series_entity(series_id)

    @callback
    def _handle_series_removed(series_id: str) -> None:
        entity = known_entities.pop(series_id, None)
        if entity is not None:
            hass.async_create_task(entity.async_remove(force_remove=True))

    entry.async_on_unload(
        async_dispatcher_connect(hass, SIGNAL_SERIES_ADDED, _handle_series_added)
    )
    entry.async_on_unload(
        async_dispatcher_connect(hass, SIGNAL_SERIES_REMOVED, _handle_series_removed)
    )


class TMDBSeriesSensor(CoordinatorEntity[TMDBCoordinator], SensorEntity):
    """Zeigt die Anzahl gesehener Episoden einer Serie an."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:television-classic"
    _attr_native_unit_of_measurement = "Episoden"
    _attr_entity_category = None

    def __init__(
        self, coordinator: TMDBCoordinator, store: TMDBStore, series_id: str, entry_id: str
    ) -> None:
        super().__init__(coordinator)
        self._store = store
        self._series_id = series_id
        self._attr_unique_id = f"{DOMAIN}_{series_id}"
        self._attr_translation_key = "series_progress"

    @property
    def _series(self) -> dict[str, Any]:
        return self._store.get_series(self._series_id) or {}

    @property
    def name(self) -> str:
        return self._series.get("name") or f"Serie {self._series_id}"

    @property
    def native_value(self) -> int:
        return self._store.get_progress(self._series_id)["watched"]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        series = self._series
        progress = self._store.get_progress(self._series_id)
        total = progress["total"]
        watched = progress["watched"]
        next_episode = self._next_unwatched_episode(series)
        return {
            "series_id": self._series_id,
            "total_episodes": total,
            "watched_episodes": watched,
            "progress_percent": round(watched / total * 100, 1) if total else 0,
            "status": series.get("status"),
            "network": series.get("network"),
            "image": series.get("image"),
            "next_unwatched_episode": next_episode,
            "archived": series.get("archived", False),
        }

    @property
    def entity_picture(self) -> str | None:
        return self._series.get("image") or None

    @staticmethod
    def _next_unwatched_episode(series: dict[str, Any]) -> str | None:
        episodes = sorted(
            series.get("episodes", {}).values(),
            key=lambda ep: (ep.get("season_number", 0), ep.get("episode_number", 0)),
        )
        watched = series.get("watched", {})
        for ep in episodes:
            if ep["episode_id"] not in watched:
                return f"S{ep['season_number']:02d}E{ep['episode_number']:02d} – {ep['name']}"
        return None

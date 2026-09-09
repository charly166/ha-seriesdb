"""Persistente Ablage der verfolgten Serien und gesehenen Episoden.

Nutzt das eingebaute Storage-Helper von Home Assistant, die Daten landen
also ganz normal unter `.storage/ha_seriesdb_data`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TMDBStore:
    """Verwaltet `{"series": {series_id: {...}}}` und speichert es persistent."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"series": {}}

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if stored:
            self._data = stored
        self._data.setdefault("series", {})

    async def _async_save(self) -> None:
        await self._store.async_save(self._data)

    # -- Lesezugriffe -------------------------------------------------

    def get_all_series(self) -> dict[str, Any]:
        return self._data["series"]

    def get_series(self, series_id: str) -> dict[str, Any] | None:
        return self._data["series"].get(str(series_id))

    def is_tracked(self, series_id: str) -> bool:
        return str(series_id) in self._data["series"]

    # -- Serien verwalten ----------------------------------------------

    async def async_add_series(self, series_id: str, info: dict[str, Any]) -> None:
        series_id = str(series_id)
        existing = self._data["series"].get(series_id, {})
        self._data["series"][series_id] = {
            "series_id": series_id,
            "name": info.get("name", existing.get("name", "")),
            "overview": info.get("overview", existing.get("overview", "")),
            "image": info.get("image", existing.get("image", "")),
            "status": info.get("status", existing.get("status", "")),
            "network": info.get("network", existing.get("network", "")),
            "added_at": existing.get("added_at", _now()),
            "episodes": existing.get("episodes", {}),
            "watched": existing.get("watched", {}),
            "archived": existing.get("archived", False),
        }
        await self._async_save()

    async def async_remove_series(self, series_id: str) -> None:
        self._data["series"].pop(str(series_id), None)
        await self._async_save()

    async def async_update_episodes(self, series_id: str, episodes: list[dict[str, Any]]) -> None:
        """Aktualisiert die bekannten Episoden einer Serie, ohne den Sehstatus zu verlieren."""
        series_id = str(series_id)
        series = self._data["series"].get(series_id)
        if series is None:
            return
        episodes_by_id = {ep["episode_id"]: ep for ep in episodes}
        series["episodes"] = episodes_by_id
        # gesehen-Markierungen für inzwischen gelöschte Episoden entfernen
        series["watched"] = {
            ep_id: ts for ep_id, ts in series["watched"].items() if ep_id in episodes_by_id
        }
        await self._async_save()

    # -- Sehstatus -------------------------------------------------------

    async def async_set_episode_watched(
        self, series_id: str, episode_id: str, watched: bool
    ) -> None:
        series = self._data["series"].get(str(series_id))
        if series is None:
            return
        episode_id = str(episode_id)
        if watched:
            series["watched"][episode_id] = _now()
        else:
            series["watched"].pop(episode_id, None)
        await self._async_save()

    async def async_set_season_watched(
        self, series_id: str, season_number: int, watched: bool
    ) -> None:
        series = self._data["series"].get(str(series_id))
        if series is None:
            return
        for ep_id, ep in series["episodes"].items():
            if ep.get("season_number") == season_number:
                if watched:
                    series["watched"][ep_id] = _now()
                else:
                    series["watched"].pop(ep_id, None)
        await self._async_save()

    async def async_mark_watched_up_to(self, series_id: str, episode_id: str) -> None:
        """Markiert die angegebene Episode sowie alle vorherigen als gesehen.

        "Vorherig" bezieht sich auf (Staffelnummer, Episodennummer), damit
        z.B. das Anhaken von S03E04 automatisch auch S01, S02 und S03E01-03
        mit markiert.
        """
        series = self._data["series"].get(str(series_id))
        if series is None:
            return
        target = series["episodes"].get(str(episode_id))
        if target is None:
            return
        target_key = (target.get("season_number", 0), target.get("episode_number", 0))
        for ep_id, ep in series["episodes"].items():
            key = (ep.get("season_number", 0), ep.get("episode_number", 0))
            if key <= target_key:
                series["watched"][ep_id] = _now()
        await self._async_save()

    def get_progress(self, series_id: str) -> dict[str, int]:
        series = self._data["series"].get(str(series_id))
        if series is None:
            return {"total": 0, "watched": 0}
        total = len(series["episodes"])
        watched = len(series["watched"])
        return {"total": total, "watched": watched}

    # -- Archiv ------------------------------------------------------------

    async def async_set_archived(self, series_id: str, archived: bool) -> None:
        series = self._data["series"].get(str(series_id))
        if series is None:
            return
        series["archived"] = bool(archived)
        await self._async_save()

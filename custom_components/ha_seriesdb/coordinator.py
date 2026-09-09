"""DataUpdateCoordinator, der die Episodenlisten der verfolgten Serien aktuell hält."""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import TMDBClient, TMDBError
from .const import DOMAIN, UPDATE_INTERVAL_HOURS
from .store import TMDBStore

_LOGGER = logging.getLogger(__name__)


class TMDBCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Holt regelmäßig neue Episoden für alle gemerkten Serien nach."""

    def __init__(self, hass: HomeAssistant, client: TMDBClient, store: TMDBStore) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(hours=UPDATE_INTERVAL_HOURS),
        )
        self.client = client
        self.store = store

    async def _async_update_data(self) -> dict[str, Any]:
        summary: dict[str, Any] = {}
        for series_id in list(self.store.get_all_series().keys()):
            try:
                episodes = await self.client.async_get_episodes(series_id)
                await self.store.async_update_episodes(series_id, episodes)
            except TMDBError as err:
                _LOGGER.warning("Konnte Episoden für Serie %s nicht aktualisieren: %s", series_id, err)
                continue
            summary[series_id] = self.store.get_progress(series_id)
        return summary

    async def async_refresh_series(self, series_id: str) -> None:
        """Aktualisiert gezielt nur eine einzelne Serie (z.B. direkt nach dem Hinzufügen)."""
        try:
            episodes = await self.client.async_get_episodes(series_id)
        except TMDBError as err:
            raise UpdateFailed(str(err)) from err
        await self.store.async_update_episodes(series_id, episodes)

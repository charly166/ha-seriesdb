"""Automatische Registrierung der Lovelace-Karte als Dashboard-Ressource.

Registriert `ha-seriesdb-card.js` als Lovelace-"Modul"-Ressource im
Storage-Modus - genau so, wie es der manuelle Weg über "Einstellungen ->
Dashboards -> Ressourcen" auch tut.

Zwei wichtige, live gefundene Details (siehe README "Technische Hinweise"
für die volle Geschichte):

1. Das Attribut heißt `resource_mode` (nicht `mode`) auf der
   `LovelaceData`-Datenklasse - siehe
   homeassistant/components/lovelace/__init__.py im Home-Assistant-Kern.
2. Die Ressourcen-Collection wird vom Kern nur "lazy" geladen, ausgelöst
   durch das Frontend (bekannter, zum Zeitpunkt dieses Codes offener
   Home-Assistant-Bug: https://github.com/home-assistant/core/issues/165767).
   Statt passiv auf `resources.loaded` zu warten, wird hier deshalb aktiv
   `await resources.async_load()` aufgerufen, falls noch nicht geladen -
   das ist ungefährlich (reiner Lesevorgang von der Festplatte) und macht
   das Warten auf einen verbundenen Browser überflüssig.
"""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant

from .const import CARD_FILENAME, CARD_VERSION, STATIC_BASE_PATH

_LOGGER = logging.getLogger(__name__)

RESOURCE_URL = f"{STATIC_BASE_PATH}/{CARD_FILENAME}"


class LovelaceResourceRegistration:
    """Verwaltet die Lovelace-Ressource für die Karte."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def async_register(self) -> None:
        """Registriert (oder aktualisiert) die Ressource, falls möglich."""
        lovelace = self.hass.data.get("lovelace")
        if lovelace is None:
            _LOGGER.debug("HA SeriesDB: Lovelace ist noch nicht geladen.")
            return

        resource_mode = getattr(lovelace, "resource_mode", None)
        if resource_mode != "storage":
            _LOGGER.info(
                "HA SeriesDB: Lovelace läuft im YAML-Modus, die Karten-Ressource "
                "kann nicht automatisch eingetragen werden. Bitte manuell "
                "hinzufügen (siehe README): %s?v=%s",
                RESOURCE_URL,
                CARD_VERSION,
            )
            return

        resources = lovelace.resources
        try:
            if not resources.loaded:
                # Aktiv laden statt passiv auf das Frontend zu warten (siehe
                # Modul-Docstring / home-assistant/core#165767). Reiner
                # Lesevorgang, unbedenklich auch falls bereits geladen.
                # async_load() setzt .loaded intern selbst auf True.
                await resources.async_load()
        except Exception:  # noqa: BLE001
            _LOGGER.exception(
                "HA SeriesDB: Konnte Lovelace-Ressourcen nicht laden, "
                "automatische Registrierung übersprungen."
            )
            return

        await self._async_sync_resource(resources)

    async def _async_sync_resource(self, resources: Any) -> None:
        existing = [
            r
            for r in resources.async_items()
            if r["url"].split("?")[0] == RESOURCE_URL
        ]
        target_url = f"{RESOURCE_URL}?v={CARD_VERSION}"

        if not existing:
            _LOGGER.info("HA SeriesDB: Registriere Karte als Lovelace-Ressource.")
            await resources.async_create_item({"res_type": "module", "url": target_url})
            return

        resource = existing[0]
        current_version = (
            resource["url"].split("?v=")[-1] if "?v=" in resource["url"] else None
        )
        if current_version != CARD_VERSION:
            _LOGGER.info(
                "HA SeriesDB: Aktualisiere Karten-Ressource auf Version %s.",
                CARD_VERSION,
            )
            await resources.async_update_item(
                resource["id"], {"res_type": "module", "url": target_url}
            )

    async def async_unregister(self) -> None:
        """Entfernt die Ressource wieder (beim vollständigen Entfernen der Integration)."""
        lovelace = self.hass.data.get("lovelace")
        if lovelace is None or getattr(lovelace, "resource_mode", None) != "storage":
            return
        resources = lovelace.resources
        if not resources.loaded:
            return
        for resource in list(resources.async_items()):
            if resource["url"].split("?")[0] == RESOURCE_URL:
                await resources.async_delete_item(resource["id"])

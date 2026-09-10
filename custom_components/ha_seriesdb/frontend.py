"""Automatische Registrierung der Lovelace-Karte als Dashboard-Ressource.

Registriert `ha-seriesdb-card.js` als Lovelace-"Modul"-Ressource im
Storage-Modus - genau so, wie es der manuelle Weg über "Einstellungen ->
Dashboards -> Ressourcen" auch tut. Das unterscheidet sich bewusst von
`frontend.add_extra_js_url()`, das für generische, dashboard-unabhängige
Zusatzskripte gedacht ist und sich in der Praxis als unzuverlässig erwiesen
hat (siehe README "Technische Hinweise").

Vorgehen angelehnt an die Community-Anleitung
https://gist.github.com/KipK/3cf706ac89573432803aaa2f5ca40492, die
ihrerseits von den Integrationen marees_france und Browser Mod inspiriert
ist.
"""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later

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
            _LOGGER.debug(
                "HA SeriesDB: Lovelace ist noch nicht geladen, versuche es in 5s erneut."
            )
            async_call_later(self.hass, 5, lambda _now: self.hass.async_create_task(self.async_register()))
            return

        mode = getattr(lovelace, "mode", None)
        if mode != "storage":
            # YAML-Modus: Home Assistant erlaubt Integrationen hier keinen
            # Schreibzugriff auf die Ressourcenliste. Nutzer müssen die Karte
            # in diesem Fall manuell in ui-lovelace.yaml eintragen (siehe
            # README).
            _LOGGER.info(
                "HA SeriesDB: Lovelace läuft im YAML-Modus, die Karten-Ressource "
                "kann nicht automatisch eingetragen werden. Bitte manuell "
                "hinzufügen (siehe README): %s?v=%s",
                RESOURCE_URL,
                CARD_VERSION,
            )
            return

        await self._async_wait_for_resources(lovelace)

    async def _async_wait_for_resources(self, lovelace: Any) -> None:
        async def _check_loaded(_now: Any = None) -> None:
            if lovelace.resources.loaded:
                await self._async_sync_resource(lovelace)
            else:
                async_call_later(self.hass, 5, _check_loaded)

        await _check_loaded()

    async def _async_sync_resource(self, lovelace: Any) -> None:
        existing = [
            r
            for r in lovelace.resources.async_items()
            if r["url"].split("?")[0] == RESOURCE_URL
        ]
        target_url = f"{RESOURCE_URL}?v={CARD_VERSION}"

        if not existing:
            _LOGGER.info("HA SeriesDB: Registriere Karte als Lovelace-Ressource.")
            await lovelace.resources.async_create_item(
                {"res_type": "module", "url": target_url}
            )
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
            await lovelace.resources.async_update_item(
                resource["id"], {"res_type": "module", "url": target_url}
            )

    async def async_unregister(self) -> None:
        """Entfernt die Ressource wieder (beim vollständigen Entfernen der Integration)."""
        lovelace = self.hass.data.get("lovelace")
        if lovelace is None or getattr(lovelace, "mode", None) != "storage":
            return
        for resource in list(lovelace.resources.async_items()):
            if resource["url"].split("?")[0] == RESOURCE_URL:
                await lovelace.resources.async_delete_item(resource["id"])

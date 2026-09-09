"""Schlanker asynchroner Client für die kostenlose themoviedb.org (TMDB) API v3.

Es wird bewusst kein zusätzliches Python-Paket genutzt, sondern nur die in
Home Assistant ohnehin vorhandene aiohttp-Session, damit die Integration
keine externen Requirements benötigt.

API-Dokumentation: https://developer.themoviedb.org/reference/intro/getting-started
"""
from __future__ import annotations

import logging
from typing import Any

import async_timeout
from aiohttp import ClientSession, ContentTypeError

from .const import TMDB_BASE_URL, TMDB_IMAGE_BASE, TMDB_LANGUAGE, TMDB_POSTER_SIZE, TMDB_STILL_SIZE

_LOGGER = logging.getLogger(__name__)

REQUEST_TIMEOUT = 20


class TMDBError(Exception):
    """Allgemeiner Fehler bei der Kommunikation mit themoviedb.org."""


class TMDBAuthError(TMDBError):
    """API-Key wurde von themoviedb.org abgelehnt."""


def _image_url(path: str | None, size: str) -> str:
    if not path:
        return ""
    return f"{TMDB_IMAGE_BASE}{size}{path}"


class TMDBClient:
    """Kapselt die wenigen TMDB-Endpunkte, die diese Integration braucht.

    TMDB nutzt (in der kostenlosen "API Key (v3 auth)"-Variante) einen
    simplen API-Key, der bei jeder Anfrage als Query-Parameter mitgeschickt
    wird – es ist also kein separater Login-Schritt nötig.
    """

    def __init__(self, session: ClientSession, api_key: str) -> None:
        self._session = session
        self._api_key = api_key

    async def _request(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        query = {"api_key": self._api_key, "language": TMDB_LANGUAGE}
        if params:
            query.update(params)

        try:
            async with async_timeout.timeout(REQUEST_TIMEOUT):
                resp = await self._session.get(f"{TMDB_BASE_URL}{path}", params=query)
        except Exception as err:  # noqa: BLE001
            raise TMDBError(f"Anfrage an themoviedb.org fehlgeschlagen: {err}") from err

        if resp.status == 401:
            raise TMDBAuthError("API-Key wurde von themoviedb.org abgelehnt (401).")
        if resp.status == 404:
            raise TMDBError("Nicht gefunden (404) bei themoviedb.org.")
        if resp.status == 429:
            raise TMDBError("Rate-Limit von themoviedb.org erreicht, bitte kurz warten.")
        if resp.status != 200:
            raise TMDBError(f"themoviedb.org antwortete mit HTTP {resp.status} für {path}.")

        try:
            return await resp.json()
        except ContentTypeError as err:
            raise TMDBError("Unerwartete Antwort von themoviedb.org.") from err

    async def async_test_connection(self) -> None:
        """Wird beim Einrichten des Config-Flows genutzt, um den API-Key zu prüfen."""
        await self._request("/authentication")

    async def async_search_series(self, query: str) -> list[dict[str, Any]]:
        """Sucht Serien über /search/tv und liefert eine vereinfachte Liste zurück."""
        data = await self._request(
            "/search/tv", params={"query": query, "include_adult": "false"}
        )
        results = []
        for item in data.get("results", []):
            series_id = item.get("id")
            if series_id is None:
                continue
            year = (item.get("first_air_date") or "")[:4]
            results.append(
                {
                    "series_id": str(series_id),
                    "name": item.get("name") or item.get("original_name") or "?",
                    "overview": item.get("overview", ""),
                    "image": _image_url(item.get("poster_path"), TMDB_POSTER_SIZE),
                    "year": year,
                    "status": "",
                    "network": "",
                }
            )
        return results

    async def async_get_series(self, series_id: str) -> dict[str, Any]:
        """Holt Serien-Infos (Titel, Poster, Beschreibung, Status, Staffelliste)."""
        series = await self._request(f"/tv/{series_id}")
        networks = series.get("networks") or []
        year = (series.get("first_air_date") or "")[:4]
        seasons = [
            {
                "season_number": s.get("season_number"),
                "episode_count": s.get("episode_count", 0),
            }
            for s in series.get("seasons", [])
            if s.get("season_number") is not None
        ]
        return {
            "series_id": str(series_id),
            "name": series.get("name", ""),
            "overview": series.get("overview", ""),
            "image": _image_url(series.get("poster_path"), TMDB_POSTER_SIZE),
            "status": series.get("status", ""),
            "network": networks[0]["name"] if networks else "",
            "year": year,
            "_seasons": seasons,
        }

    async def async_get_episodes(self, series_id: str) -> list[dict[str, Any]]:
        """Holt alle Episoden einer Serie (eine Anfrage pro Staffel)."""
        series = await self.async_get_series(series_id)
        episodes: list[dict[str, Any]] = []
        for season in series.get("_seasons", []):
            season_number = season["season_number"]
            if not season.get("episode_count"):
                continue
            try:
                season_data = await self._request(f"/tv/{series_id}/season/{season_number}")
            except TMDBError as err:
                _LOGGER.warning(
                    "Konnte Staffel %s von Serie %s nicht laden: %s", season_number, series_id, err
                )
                continue
            for ep in season_data.get("episodes", []):
                episodes.append(
                    {
                        "episode_id": str(ep.get("id")),
                        "season_number": season_number,
                        "episode_number": ep.get("episode_number", 0),
                        "name": ep.get("name") or f"Episode {ep.get('episode_number', '?')}",
                        "aired": ep.get("air_date") or "",
                        "overview": ep.get("overview") or "",
                        "image": _image_url(ep.get("still_path"), TMDB_STILL_SIZE),
                    }
                )
        return episodes

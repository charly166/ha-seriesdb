"""Konstanten für die HA SeriesDB Integration."""

DOMAIN = "ha_seriesdb"

CONF_API_KEY = "api_key"
CONF_REGION = "region"
CONF_PROVIDER_IDS = "provider_ids"

TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/"
TMDB_POSTER_SIZE = "w342"
TMDB_STILL_SIZE = "w300"
TMDB_PROVIDER_LOGO_SIZE = "w45"
TMDB_LANGUAGE = "de-DE"

DEFAULT_REGION = "DE"

# Wird verwendet, falls /watch/providers/regions nicht erreichbar ist, damit
# die Options-Flow-UI trotzdem nutzbar bleibt (siehe api.py).
FALLBACK_REGIONS = {
    "DE": "Germany",
    "AT": "Austria",
    "CH": "Switzerland",
    "US": "United States",
    "GB": "United Kingdom",
    "FR": "France",
    "IT": "Italy",
    "ES": "Spain",
    "NL": "Netherlands",
    "PL": "Poland",
}

PLATFORMS = ["sensor"]

CARD_FILENAME = "ha-seriesdb-card.js"
STATIC_BASE_PATH = f"/{DOMAIN}"

# Wird bei jeder inhaltlichen Änderung der Karte hochgezählt. Die
# Lovelace-Ressource wird automatisch auf diese Version aktualisiert (siehe
# frontend.py) - ein manuelles Nachtragen der URL ist dadurch nicht mehr
# nötig.
CARD_VERSION = "15"

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}_data"

UPDATE_INTERVAL_HOURS = 12

SIGNAL_SERIES_ADDED = f"{DOMAIN}_series_added"
SIGNAL_SERIES_REMOVED = f"{DOMAIN}_series_removed"
SIGNAL_SERIES_UPDATED = f"{DOMAIN}_series_updated"

SERVICE_ADD_SERIES = "add_series"
SERVICE_REMOVE_SERIES = "remove_series"
SERVICE_MARK_EPISODE_WATCHED = "mark_episode_watched"
SERVICE_MARK_EPISODE_UNWATCHED = "mark_episode_unwatched"
SERVICE_MARK_SEASON_WATCHED = "mark_season_watched"
SERVICE_MARK_WATCHED_UP_TO = "mark_watched_up_to"
SERVICE_REFRESH = "refresh"
SERVICE_SET_ARCHIVED = "set_archived"
SERVICE_REFRESH_WATCH_PROVIDERS = "refresh_watch_providers"

ATTR_SERIES_ID = "series_id"
ATTR_EPISODE_ID = "episode_id"
ATTR_SEASON_NUMBER = "season_number"
ATTR_WATCHED = "watched"
ATTR_ARCHIVED = "archived"

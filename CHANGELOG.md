# Changelog

## 2.5.1

- The list filter field is now only shown when a list has more than 20 shows
  (or while a filter text is active), so short lists stay uncluttered.

## 2.5.0

- Added a search field above the show lists (My shows, Open, Archive) to
  filter by title. The filter is shared between the lists and ignores case.
  Requested in the HA MoviesDB issue tracker (charly166/ha-moviesdb#2).

## 2.4.2

- The card now loads the TMDB logo from `<config>/www/ha_seriesdb/tmdb-logo.svg`
  (or `.png`), served as `/local/ha_seriesdb/...`. This location is outside
  `custom_components`, so the file survives HACS updates (HACS replaces the
  integration folder on every update). The old location inside
  `custom_components/ha_seriesdb/www/` still works as a fallback.

## 2.4.1

- Added a reauthentication flow: if themoviedb.org rejects the stored API key,
  Home Assistant now offers a working dialog to enter a new key instead of
  requiring the integration to be removed and re-added.

## 2.4.0

- Titles, descriptions, posters and episode names are now requested from
  TMDB in the Home Assistant language (`hass.config.language`) instead of
  always German. If the language differs from what was stored, tracked shows
  are re-fetched once in the new language (on the next restart/reload).
  German instances behave exactly as before.

## 2.3.0

- The card UI is now available in **English and German** and follows the
  language of the logged-in Home Assistant user (previously everything was
  hard-coded German). All other languages fall back to English.
- Further languages can be added without code changes by placing a
  `<lang>.json` file (e.g. `fr.json`) into `www/translations/`; missing keys
  fall back to English.
- Error messages from the backend are now shown in the card's language.

## 2.2.0

- New "Open" tab between "My Shows" and "Archive": lists only shows that
  have episodes which have already aired but are not yet watched (episodes
  announced for the future don't count). The tab shows a counter like the
  other tabs.
- The card now remembers the last selected tab (stored locally in the
  browser's localStorage, nothing is sent anywhere).
- Tab bar scrolls horizontally on very narrow screens instead of overflowing.

## 2.1.0

- Added streaming availability per show, sourced from JustWatch via TMDB's
  watch-providers API: shows which of your own configured streaming
  services currently carry a series (subscription/rent/buy/free-with-ads),
  filtered and highlighted against your region and subscribed providers.
- New options flow (Settings → Devices & Services → HA SeriesDB →
  Configure) to pick your region and your own streaming providers from a
  searchable, alphabetically sorted list.
- New `available_on` sensor attribute for automations (e.g. "show X is now
  on Netflix").
- New `refresh_watch_providers` service to force-refresh availability for a
  single show or the whole watchlist on demand.

## 2.0.2

- Fixed: checking off an episode further down in a long episode list jumped
  the whole card back to the top. The card fully rebuilds its episode list
  on every re-render, which reset the scroll position of the list to 0 each
  time. The scroll position is now preserved across re-renders.
- Checking an episode now also auto-collapses earlier seasons that just
  became fully watched as a result (matching the existing behavior when
  first opening a show), while explicitly scrolling to keep the
  just-checked episode in view instead of jumping away.

## 1.0.0

Initial public release.

- TV show search, watchlist, and per-episode watched tracking via the free
  TMDB API
- Custom Lovelace card with "My Shows" / "Archive" / "Add Show" tabs
- Automatic "mark all previous episodes watched" when checking an episode
- Season-level watched toggling with auto-collapse
- Archive tab for completed shows
- Sensor entity per tracked show + automation services
- Local icon under Devices & Services (Home Assistant 2026.3+)
- TMDB attribution notice built into the card

## 2.0.1

- CI: aligned `.github/workflows/validate.yml` with the official HACS
  Action template (https://www.hacs.xyz/docs/publish/action/) — added
  `permissions: {}`, removed the unnecessary checkout step before
  `hacs/action`, switched to a daily schedule, and run on all branches.
  No functional changes to the integration or card.

## 2.0.0

- Card now registers itself automatically as a Lovelace dashboard resource,
  writing into the same storage collection the manual "Resources" UI uses.
  Two earlier attempts (via `add_extra_js_url()`, then a first version of
  the direct storage-write approach) were reverted after hitting a race
  condition and a wrong attribute name (`lovelace.mode` instead of the
  correct `lovelace.resource_mode`) combined with a currently open Home
  Assistant core bug (home-assistant/core#165767) around lazy-loaded
  resources. Fixed by actively calling `resources.async_load()` instead of
  waiting for the frontend to trigger it. Falls back to a manual step only
  for dashboards still in legacy YAML mode.
- Card now properly fills the assigned grid cell height in "Sections"
  dashboards (getGridOptions() + height: 100% flex layout), matching
  standard behavior of other Home Assistant cards.
- Added a minimal `getConfigElement()` / card editor, which is required for
  Home Assistant's card edit dialog to show its "Layout" size tab at all
  (without it, the dialog falls back to a bare YAML view with no tabs).
- Added HACS support (`hacs.json`, validation workflow, English README).
- Added a screenshot of the card to the README.
- manifest.json: fixed translation strings (no raw URLs, per hassfest),
  fixed missing "http" dependency, added "frontend" dependency.
- GitHub Actions workflow bumped to actions/checkout@v6.

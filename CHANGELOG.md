# Changelog

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

## 1.1.0 (unreleased)

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
- manifest.json: fixed translation strings (no raw URLs, per hassfest),
  fixed missing "http" dependency, added "frontend" dependency.
- GitHub Actions workflow bumped to actions/checkout@v6.

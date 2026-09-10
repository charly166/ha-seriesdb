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

- Card now registers itself automatically as a Lovelace dashboard resource
  via the same storage mechanism the manual "Resources" UI uses, instead of
  requiring a one-time manual step. Falls back to manual registration only
  for dashboards still in legacy YAML mode.
- Card now properly fills the assigned grid cell height in "Sections"
  dashboards (getGridOptions() + height: 100% flex layout), matching
  standard behavior of other Home Assistant cards.
- manifest.json: added "frontend" dependency, fixed translation strings
  (no raw URLs, per hassfest), fixed missing "http" dependency.
- GitHub Actions workflow bumped to actions/checkout@v6.

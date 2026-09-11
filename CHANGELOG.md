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

- Attempted automatic Lovelace resource registration (both via
  `add_extra_js_url()` and directly via the resource storage collection);
  reverted both times after hitting a race condition and a currently open
  Home Assistant core bug (home-assistant/core#165767) respectively. The
  card continues to require the one-time manual "Resources" registration
  step, same as before.
- Card now properly fills the assigned grid cell height in "Sections"
  dashboards (getGridOptions() + height: 100% flex layout), matching
  standard behavior of other Home Assistant cards.
- manifest.json: fixed translation strings (no raw URLs, per hassfest),
  fixed missing "http" dependency.
- GitHub Actions workflow bumped to actions/checkout@v6.

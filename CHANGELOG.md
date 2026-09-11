# Changelog

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

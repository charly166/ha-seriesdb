# HA SeriesDB – Home Assistant Custom Integration

<p align="center">
  <img src="docs/logo.png" alt="HA SeriesDB Logo" width="360">
</p>

<p align="center">
  <a href="https://github.com/hacs/integration"><img src="https://img.shields.io/badge/HACS-Custom-41BDF5.svg" alt="hacs_badge"></a>
  <a href="https://github.com/charly166/ha-seriesdb/releases"><img src="https://img.shields.io/github/v/release/charly166/ha-seriesdb" alt="GitHub Release"></a>
  <a href="https://github.com/charly166/ha-seriesdb/blob/main/LICENSE"><img src="https://img.shields.io/github/license/charly166/ha-seriesdb" alt="License"></a>
</p>

[Deutsche Version / German version](README.de.md)

---

A Home Assistant custom integration with its own Lovelace card (GUI) for
tracking TV shows: search for a series via the free **themoviedb.org (TMDB)
API**, add it to your watchlist, and check off episodes as you watch them.

## Features

- Search themoviedb.org and add shows to your watchlist
- "My Shows" overview with poster, watch progress (X / Y episodes), and show
  status (Returning / Ended / Canceled / ...)
- Per-show detail view: collapsible seasons, check off individual episodes,
  or mark a whole season watched with one click. Checking an episode also
  marks every earlier episode as watched automatically. Fully-watched
  seasons collapse automatically when you open a show.
- **Archive**: move a show to a separate "Archive" tab once you're done with
  it (e.g. fully watched and the show has ended)
- Card width is resizable by dragging in modern "Sections" dashboards
- Own icon/logo under Settings → Devices & Services (Home Assistant 2026.3+)
- A sensor entity per tracked show (watch progress, next unwatched episode)
  for use in automations
- Services for automations: `add_series`, `remove_series`,
  `mark_episode_watched`, `mark_episode_unwatched`, `mark_watched_up_to`,
  `mark_season_watched`, `set_archived`, `refresh`
- All data (watchlist, watched status, archive) is stored locally in Home
  Assistant (`.storage/ha_seriesdb_data`) – no cloud account needed beyond
  the free TMDB API key

## Legal: TMDB Attribution & License

This integration uses the free TMDB API. Its terms of use require a visible
attribution notice with logo. The card already displays the required text
notice automatically as a small footer – **you only need to add the actual
TMDB logo file once**, since TMDB does not permit automated redistribution
of it:

1. Download one of the approved logos from
   https://www.themoviedb.org/about/logos-attribution (SVG or PNG, e.g. the
   short square variant).
2. Save it unmodified (don't change color/aspect ratio) as `tmdb-logo.svg`
   (or `.png`, in which case adjust the filename once in
   `custom_components/ha_seriesdb/www/ha-seriesdb-card.js`, method
   `_renderTmdbAttribution()`) here:
   ```
   custom_components/ha_seriesdb/www/tmdb-logo.svg
   ```
3. Done – until that file exists, the card simply hides the logo
   placeholder and keeps showing the required text.

The code itself is licensed under the [MIT License](LICENSE) and may be
freely redistributed, modified, and published. The "HA SeriesDB" logo shown
in the card header is separate artwork provided by the project author.

This is not legal advice, just a summary of TMDB's publicly available terms
of use (https://www.themoviedb.org/api-terms-of-use) at the time of writing.
Please double-check the current version yourself before publishing.

## Installation

### Via HACS (recommended)

1. In Home Assistant, open **HACS**
2. Click the three-dot menu (top right) → **Custom repositories**
3. Add `https://github.com/charly166/ha-seriesdb` as repository type
   **Integration**
4. Search for **"HA SeriesDB"** in HACS and download it
5. Restart Home Assistant

### Manual

1. Copy the `custom_components/ha_seriesdb` folder into your Home Assistant
   configuration's `custom_components` directory, e.g. via Samba/SSH to:
   ```
   <config>/custom_components/ha_seriesdb/
   ```
2. Restart Home Assistant

## 1. Get a free TMDB API key

1. Create a free account at https://www.themoviedb.org if you don't have one
   yet.
2. Under **Profile → Settings → API** (or directly
   https://www.themoviedb.org/settings/api) request an API key. TMDB will
   ask about the intended use – "Developer" / personal use is fine.
3. Copy the displayed **"API Key (v3 auth)"** (not the "API Read Access
   Token" – that one is not used by this integration).

TMDB's free tier allows generous rate limits for personal use (roughly ~40
requests per 10 seconds), which is more than enough for this integration.

## 2. Set up the integration

**Settings → Devices & Services → Add Integration** → search for "HA
SeriesDB" → enter your API key.

## 3. Register the card as a dashboard resource (one-time, manual)

The card does **not** register itself automatically – that turned out to be
unreliable in practice (see Technical Notes below). Instead, register it the
same way as any other custom card:

1. **Settings → Dashboards → three-dot menu (top right) → Resources**
2. **+ Add Resource**
3. URL: `/ha_seriesdb/ha-seriesdb-card.js?v=11` (the exact current version
   number is also logged at startup – **Settings → System → Logs**, search
   for "HA SeriesDB")
4. Resource type: **JavaScript Module**
5. Save, then reload the page once.

**After a future update** of this integration, edit this resource entry and
bump the `?v=...` number to match – the log message tells you the currently
expected number.

## 4. Add the card to your dashboard

1. Edit dashboard → **Add Card** → scroll to the bottom → **Manual**
2. Paste:
   ```yaml
   type: custom:ha-seriesdb-card
   ```
3. Save. The card shows three tabs: "My Shows", "Archive", and "Add Show"
   (search).

If your dashboard view uses the **"Sections"** layout (the default for new
dashboards since Home Assistant 2024.5), you can resize the card by dragging
its edge in the dashboard editor – it defaults to full width but can be
narrowed down. Older "Masonry" views don't support per-card width (a
limitation of that view type, not of the card).

**If the card still renders narrow (1 column) even after widening the
section:** Home Assistant stores each card's size in the dashboard config
(`grid_options`). If the card was added before this behavior existed, an old
small value may still be saved there, overriding the card's new default.
Either remove and re-add the card, or edit the card as YAML in the dashboard
editor and delete the `grid_options:` line (or set `columns: 12`).

## 5. Usage

- **Add a show**: "Add Show" tab → type a title (search starts automatically
  from 2 characters) → click "Add" on the desired result. A brief
  confirmation toast appears, then the search field clears automatically.
- **Check off episodes**: click a poster in "My Shows" → the detail view
  shows collapsible seasons, each episode has a checkbox. Checking an
  episode automatically marks every earlier episode (by season/episode
  number) as watched too – you only need to click the most recent one you
  watched. Unchecking only resets that single episode. "Mark all watched" /
  "Reset all" toggle a whole season at once and collapse/expand it
  accordingly. There's a "Back to overview" link both above and below the
  episode list.
- **Archive a show**: in the detail view, click "Archive" – the show moves
  to the "Archive" tab. If a show is fully watched and its TMDB status is
  "Ended" or "Canceled", the detail view shows a hint suggesting this. "Move
  back from archive" reverses it at any time.
- **Remove a show**: in the detail view, next to the show info.

## Automation example

```yaml
automation:
  - alias: "New episode available"
    trigger:
      - platform: state
        entity_id: sensor.game_of_thrones # entity_id depends on the show
        attribute: next_unwatched_episode
    condition:
      - condition: template
        value_template: "{{ trigger.to_state.attributes.next_unwatched_episode is not none }}"
    action:
      - service: notify.mobile_app_your_phone
        data:
          message: >
            New episode of {{ trigger.to_state.name }}:
            {{ trigger.to_state.attributes.next_unwatched_episode }}
```

## Technical Notes

- Pure Python standard library + `aiohttp` (already bundled with Home
  Assistant) – no extra pip packages are installed.
- The Lovelace card is a plain Vanilla Web Component, no build step, and
  loads **no external web fonts** (a deliberate choice: pulling in Google
  Fonts on every card load sends the visitor's IP address to Google, which
  courts such as the Munich Regional Court (LG München I, judgment of
  2022-01-20, case 3 O 17493/20) have ruled a GDPR violation without
  consent). System fonts are used instead.
- Authentication uses the simple TMDB "API Key (v3 auth)" as a query
  parameter on every request – no separate login/token refresh needed.
- Episodes are fetched one season at a time (`/tv/{id}/season/{n}`), since
  TMDB doesn't offer a single "all episodes of this show" endpoint.
- Text/descriptions default to **German** (`language=de-DE`), matching this
  project's origin. Change the `TMDB_LANGUAGE` constant in `const.py` (e.g.
  to `en-US`) if you'd prefer another language – TMDB may return an empty
  field if no translation exists for a given show in your chosen language.
- `iot_class: cloud_polling` – the integration actively polls
  themoviedb.org, by default every 12 hours for tracked shows, plus on every
  manual search/add action.
- **The card intentionally does not self-register as a global script.**
  Earlier versions used Home Assistant's `frontend.add_extra_js_url()`
  helper to load the card automatically into every dashboard. In practice
  this turned out to race against Home Assistant's own card-creation logic:
  if the script hadn't finished loading (and defining its custom element)
  by the time a dashboard tried to instantiate `<ha-seriesdb-card>`, Home
  Assistant would show a generic "Configuration error" instead of retrying
  successfully – with no JavaScript error logged at all, making it
  particularly hard to diagnose, and it behaved inconsistently across
  browsers and cache states. Registering the card through Home Assistant's
  official **Lovelace Resources** mechanism instead (Settings → Dashboards →
  Resources – the same path virtually every other custom card, including
  everything installed via HACS, uses) resolved this reliably, since that
  path is properly integrated with Lovelace's own resource-loading and
  card-creation lifecycle. This is why the one-time manual resource
  registration step above is required and intentional, not an oversight.
- Own icon in "Devices & Services": since Home Assistant 2026.3, custom
  integrations can ship their own icon locally (`brand/` folder with
  `icon.png`, `icon@2x.png`, `logo.png`, `logo@2x.png`) – no pull request to
  the separate `home-assistant/brands` repository required. This is already
  included and needs no further configuration. On older Home Assistant
  versions, a generic placeholder icon is shown instead.

## Folder structure

```
ha-seriesdb/
├── LICENSE                MIT license
├── README.md / README.de.md
├── hacs.json               HACS metadata
├── .github/workflows/      HACS + hassfest validation
├── docs/logo.png           Full logo (icon + wordmark) for README/repo
└── custom_components/ha_seriesdb/
    ├── __init__.py          Setup, services, static file serving
    ├── api.py                Slim themoviedb.org (TMDB) v3 client
    ├── brand/                 Local icons for "Devices & Services" (HA 2026.3+)
    │   ├── icon.png / icon@2x.png
    │   └── logo.png / logo@2x.png
    ├── config_flow.py        Setup dialog (API key)
    ├── const.py
    ├── coordinator.py        Periodic episode refresh
    ├── manifest.json
    ├── sensor.py              One sensor entity per tracked show
    ├── services.yaml
    ├── store.py               Persistent watchlist + watched status + archive
    ├── strings.json / translations/
    ├── websocket_api.py       WebSocket commands used by the card
    └── www/
        ├── ha-seriesdb-card.js    Lovelace card (GUI)
        ├── ha-seriesdb-icon.png   App icon for the card header
        └── tmdb-logo.svg          ⚠️ you need to add this yourself, see above
```

## Minimum Requirements

- Home Assistant **2024.5.0** or newer (older versions work too, just
  without the resizable card width and the local "Devices & Services" icon)

## License

MIT – see [LICENSE](LICENSE) for details.

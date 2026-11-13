/**
 * HA SeriesDB – Lovelace-Karte
 *
 * Reines Vanilla-Web-Component (keine Build-Schritte, kein lit-Import nötig),
 * damit die Karte einfach als statische Datei von der Integration ausgeliefert
 * werden kann. Kommuniziert ausschließlich über die WebSocket-Befehle des
 * "ha_seriesdb"-Custom-Components.
 */

// Der komplette Inhalt läuft in einer eigenen, isolierten Funktion (IIFE).
// Grund: const/class-Deklarationen auf oberster Ebene eines klassischen
// <script>-Tags teilen sich den globalen Gültigkeitsbereich der gesamten
// Seite. Würde diese Datei aus irgendeinem Grund zweimal geladen (z.B. durch
// eine noch nicht bereinigte alte Registrierung nach einem Update), würde
// die zweite Ausführung sonst mit einem fatalen "Identifier 'DOMAIN' has
// already been declared" abstürzen, bevor überhaupt eine interne Prüfung
// greifen könnte. Innerhalb der Funktion ist das kein Problem mehr, und die
// customElements.get()-Prüfung unten sorgt dafür, dass eine zweite
// Ausführung einfach folgenlos bleibt statt abzustürzen.
(function () {
  "use strict";

const DOMAIN = "ha_seriesdb";

// Spaltenzahl der Listen: "auto" richtet sich nach poster_size, 1 ist eine
// Listenansicht mit Beschreibung. Die Wahl am Gerät wird im Browser gemerkt.
const COLUMN_CHOICES = ["auto", "1", "2", "3"];
const COLUMNS_STORAGE_KEY = `${DOMAIN}_columns`;

// Kachelgröße der Poster in den Listen (Kartenoption `poster_size`).
const POSTER_SIZES = {
  small: { min: 120, height: 168 },
  medium: { min: 160, height: 224 },
  large: { min: 200, height: 280 },
};

// --- Mehrsprachigkeit -------------------------------------------------------
// Die Kartensprache folgt der Sprache des angemeldeten Home-Assistant-Benutzers
// (hass.locale.language). Deutsch und Englisch sind fest eingebaut. Für weitere
// Sprachen lädt die Karte optional www/translations/<sprache>.json (z.B.
// fr.json) - fehlt die Datei oder ein Schlüssel, wird Englisch verwendet.
const TRANSLATIONS = {
  de: {
    tab_mine: "Meine Serien",
    tab_open: "Offen",
    tab_archive: "Archiv",
    tab_search: "Serie hinzufügen",
    empty_mine: "Noch keine Serien in der Watchlist. Wechsle oben zu „Serie hinzufügen“, um loszulegen.",
    empty_open: "Keine Serie mit offenen Episoden – du bist auf dem aktuellen Stand.",
    empty_archive: "Noch keine archivierten Serien. Du kannst eine Serie in ihrer Detailansicht archivieren, sobald sie komplett gesehen ist.",
    status_returning: "Wiederkehrend",
    status_planned: "Geplant",
    status_in_production: "In Produktion",
    status_ended: "Beendet",
    status_canceled: "Abgesetzt",
    status_pilot: "Pilotfolge",
    available: "Verfügbar: {list}",
    episodes_progress: "{watched} / {total} Episoden",
    search_placeholder: "Serientitel eingeben …",
    filter_placeholder: "Liste durchsuchen …",
    no_filter_results: "Keine Serien in dieser Liste gefunden.",
    persons_for: "Vorgemerkt für",
    err_persons: "Die Personen konnten nicht gespeichert werden.",
    poster_size_label: "Postergröße",
    poster_size_small: "Klein",
    poster_size_medium: "Mittel",
    poster_size_large: "Groß",
    poster_enlarge: "Poster vergrößern",
    columns_label: "Spalten",
    columns_auto: "Auto",
    data_source: "Datenquelle: themoviedb.org (kostenlose API)",
    searching: "Suche läuft …",
    no_results: "Keine Treffer.",
    added: "Hinzugefügt",
    add: "Hinzufügen",
    back: "‹ Zurück zur Übersicht",
    loading_series: "Lade Serie …",
    archive_hint: "Komplett gesehen und abgeschlossen – jetzt archivieren?",
    archive: "Archivieren",
    unarchive: "Aus Archiv zurückholen",
    remove: "Aus Watchlist entfernen",
    season_specials: "Specials",
    season_n: "Staffel {n}",
    season_reset: "Alle zurücksetzen",
    season_all: "Alle gesehen",
    available_on_title: "Verfügbar auf",
    loading_availability: "Lade Verfügbarkeit …",
    cat_flatrate: "Streaming (Abo)",
    cat_free: "Kostenlos",
    cat_ads: "Kostenlos mit Werbung",
    cat_rent: "Leihen",
    cat_buy: "Kaufen",
    no_availability_region: "Aktuell keine bekannte Streaming-Verfügbarkeit in {region}.",
    no_availability: "Aktuell keine bekannte Streaming-Verfügbarkeit.",
    hint_providers: "Tipp: Trage deine Streamingdienste unter Einstellungen → Geräte & Dienste → HA SeriesDB → Konfigurieren ein, damit sie hier hervorgehoben werden.",
    all_options_link: "Alle Optionen auf TMDB ansehen",
    attribution_suffix: " · Daten von JustWatch, bereitgestellt über TMDB.",
    attribution_only: "Verfügbarkeitsdaten von JustWatch, bereitgestellt über TMDB.",
    series_fallback: "Serie",
    added_toast: "„{title}“ wurde zur Watchlist hinzugefügt.",
    err_load_list: "Konnte Watchlist nicht laden. Ist die Integration eingerichtet?",
    err_search: "Suche fehlgeschlagen.",
    err_add: "Serie konnte nicht hinzugefügt werden.",
    err_remove: "Serie konnte nicht entfernt werden.",
    err_load_series: "Serie konnte nicht geladen werden.",
    err_episode: "Konnte Episode nicht aktualisieren.",
    err_episodes: "Konnte Episoden nicht aktualisieren.",
    err_season: "Konnte Staffel nicht aktualisieren.",
    err_archived: "Konnte Archivstatus nicht ändern.",
    err_not_configured: "Die Integration ist nicht eingerichtet.",
    err_not_found: "Die Serie wird nicht verfolgt.",
    err_tmdb: "Fehler bei der Kommunikation mit themoviedb.org. Details stehen im Home-Assistant-Log.",
    editor_text: "Breite und Höhe lassen sich über den Reiter „Layout“ einstellen. Region und eigene Streamingdienste werden unter Einstellungen → Geräte & Dienste → HA SeriesDB → Konfigurieren eingestellt.",
    card_description: "Serien-Watchlist mit themoviedb.org als Datenquelle – Episoden abhaken.",
  },
  en: {
    tab_mine: "My shows",
    tab_open: "Open",
    tab_archive: "Archive",
    tab_search: "Add show",
    empty_mine: "No shows on your watchlist yet. Switch to “Add show” above to get started.",
    empty_open: "No show with open episodes – you're all caught up.",
    empty_archive: "No archived shows yet. You can archive a show in its detail view once you've watched it completely.",
    status_returning: "Returning",
    status_planned: "Planned",
    status_in_production: "In production",
    status_ended: "Ended",
    status_canceled: "Canceled",
    status_pilot: "Pilot",
    available: "Available: {list}",
    episodes_progress: "{watched} / {total} episodes",
    search_placeholder: "Enter show title …",
    filter_placeholder: "Search this list …",
    no_filter_results: "No shows found in this list.",
    persons_for: "Tagged for",
    err_persons: "Could not save the people.",
    poster_size_label: "Poster size",
    poster_size_small: "Small",
    poster_size_medium: "Medium",
    poster_size_large: "Large",
    poster_enlarge: "Enlarge poster",
    columns_label: "Columns",
    columns_auto: "Auto",
    data_source: "Data source: themoviedb.org (free API)",
    searching: "Searching …",
    no_results: "No results.",
    added: "Added",
    add: "Add",
    back: "‹ Back to overview",
    loading_series: "Loading show …",
    archive_hint: "Fully watched and finished – archive it now?",
    archive: "Archive",
    unarchive: "Restore from archive",
    remove: "Remove from watchlist",
    season_specials: "Specials",
    season_n: "Season {n}",
    season_reset: "Reset all",
    season_all: "Mark all watched",
    available_on_title: "Available on",
    loading_availability: "Loading availability …",
    cat_flatrate: "Streaming (subscription)",
    cat_free: "Free",
    cat_ads: "Free with ads",
    cat_rent: "Rent",
    cat_buy: "Buy",
    no_availability_region: "No known streaming availability in {region} right now.",
    no_availability: "No known streaming availability right now.",
    hint_providers: "Tip: Enter your streaming services under Settings → Devices & Services → HA SeriesDB → Configure to have them highlighted here.",
    all_options_link: "See all options on TMDB",
    attribution_suffix: " · Data from JustWatch, provided via TMDB.",
    attribution_only: "Availability data from JustWatch, provided via TMDB.",
    series_fallback: "Show",
    added_toast: "“{title}” was added to the watchlist.",
    err_load_list: "Could not load the watchlist. Is the integration set up?",
    err_search: "Search failed.",
    err_add: "Could not add the show.",
    err_remove: "Could not remove the show.",
    err_load_series: "Could not load the show.",
    err_episode: "Could not update the episode.",
    err_episodes: "Could not update the episodes.",
    err_season: "Could not update the season.",
    err_archived: "Could not change the archive status.",
    err_not_configured: "The integration is not set up.",
    err_not_found: "This show is not on your watchlist.",
    err_tmdb: "Error communicating with themoviedb.org. See the Home Assistant log for details.",
    editor_text: "Width and height can be set on the “Layout” tab. Region and your own streaming services are set under Settings → Devices & Services → HA SeriesDB → Configure.",
    card_description: "TV show watchlist using themoviedb.org as data source – check off episodes.",
  },
};

const EXTRA_TABLES = {};

function detectLang(hass) {
  const raw =
    (hass && ((hass.locale && hass.locale.language) || hass.language)) ||
    (typeof navigator !== "undefined" ? navigator.language : "") ||
    "en";
  const lang = String(raw).toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(lang) ? lang : "en";
}

function loadExtraTable(lang, onLoaded) {
  if (TRANSLATIONS[lang] || lang in EXTRA_TABLES) return;
  EXTRA_TABLES[lang] = null;
  fetch(`/${DOMAIN}/translations/${lang}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((table) => {
      if (table && typeof table === "object") {
        EXTRA_TABLES[lang] = table;
        onLoaded();
      }
    })
    .catch(() => {
      // Keine Übersetzungsdatei für diese Sprache - Englisch bleibt aktiv.
    });
}

function translate(lang, key, vars) {
  const table = TRANSLATIONS[lang] || EXTRA_TABLES[lang] || {};
  let text = table[key] !== undefined ? table[key] : TRANSLATIONS.en[key];
  if (text === undefined) return key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

const TAB_IDS = ["mine", "open", "archive", "search"];
// Filterfeld erst ab dieser Listengröße anzeigen
const LIST_FILTER_MIN_ITEMS = 20;
const ACTIVE_TAB_STORAGE_KEY = `${DOMAIN}_active_tab`;

const PROVIDER_CATEGORY_ORDER = ["flatrate", "free", "ads", "rent", "buy"];

// Hinweis: Es wird bewusst KEIN Google-Fonts-Import mehr genutzt (das würde
// bei jedem Kartenaufruf die IP-Adresse an Google übertragen, was in
// Deutschland ohne Einwilligung als DSGVO-Verstoß gilt, vgl. LG München I,
// Urt. v. 20.01.2022 - 3 O 17493/20). Stattdessen kommen robuste
// System-Font-Stacks zum Einsatz, die auf jedem Gerät ohne Netzwerkzugriff
// vorhanden sind.
const HEADLINE_FONT =
  "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif";
const BODY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

const STYLES = `
  :host {
    --tmdb-bg: #12141c;
    --tmdb-surface: #1b1e29;
    --tmdb-surface-alt: #232738;
    --tmdb-border: #2a2f42;
    --tmdb-accent: #e8b34d;
    --tmdb-accent-soft: rgba(232, 179, 77, 0.16);
    --tmdb-watched: #4fb286;
    --tmdb-text: #eef0f5;
    --tmdb-text-muted: #8b93a7;
    display: flex;
    flex-direction: column;
    /* In einer Sections-Ansicht mit fester Zeilenzahl gibt die Rasterzelle
       eine echte Pixelhöhe vor - height:100% füllt sie dann komplett aus.
       Ohne eine solche Zelle (Masonry, "auto" Zeilen) hat der Elternknoten
       keine definierte Höhe, wodurch height:100% laut CSS-Spezifikation zu
       "auto" wird - die Karte wächst dann ganz normal mit ihrem Inhalt.
       Dasselbe Verhalten nutzen z.B. auch weather-radar-card und
       dynamic-weather-card. */
    height: 100%;
    font-family: ${BODY_FONT};
    color: var(--tmdb-text);
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--tmdb-bg);
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--tmdb-border);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 14px 20px;
    background: linear-gradient(180deg, var(--tmdb-surface) 0%, var(--tmdb-bg) 100%);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-title img {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .header h1 {
    font-family: ${HEADLINE_FONT};
    font-weight: 700;
    font-size: 24px;
    letter-spacing: 0.2px;
    margin: 0;
  }

  .sprocket-rule {
    height: 10px;
    background-image: radial-gradient(circle, var(--tmdb-border) 2.5px, transparent 2.6px);
    background-size: 16px 10px;
    background-position: 8px center;
    opacity: 0.7;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 0 20px;
    background: var(--tmdb-surface);
    /* Vier Reiter passen auf schmalen Displays nicht immer nebeneinander. */
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar { display: none; }

  .tab {
    padding: 10px 4px;
    margin-right: 16px;
    white-space: nowrap;
    flex: 0 0 auto;
    font-size: 14px;
    font-weight: 600;
    color: var(--tmdb-text-muted);
    border-bottom: 2px solid transparent;
    cursor: pointer;
    user-select: none;
  }

  .tab.active {
    color: var(--tmdb-accent);
    border-bottom-color: var(--tmdb-accent);
  }

  .body {
    position: relative;
    flex: 1 1 auto;
    min-height: 120px;
    /* Ohne begrenzenden Elternrahmen (Masonry/"auto"-Zeilen) verhindert
       dieser Standardwert, dass unterschiedlich lange Listen (z.B. "Meine
       Serien" vs. "Archiv") die Kartenhöhe und damit die Seitenhöhe
       springen lassen. Sitzt die Karte in einer Sections-Zelle mit fester
       Höhe, gewinnt stattdessen die tatsächlich zugewiesene, kleinere Höhe
       (flex-Schrumpfen dank min-height:0 weiter unten) - die Karte füllt
       dann exakt die zugewiesene Zelle aus, wie bei anderen Standard-Karten
       üblich. */
    max-height: 520px;
    overflow-y: auto;
    padding: 16px 20px 20px 20px;
  }

  .search-row {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }

  input[type="text"] {
    flex: 1;
    background: var(--tmdb-surface-alt);
    border: 1px solid var(--tmdb-border);
    border-radius: 8px;
    color: var(--tmdb-text);
    padding: 10px 12px;
    font-size: 14px;
    font-family: inherit;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--tmdb-accent);
  }

  .hint {
    color: var(--tmdb-text-muted);
    font-size: 13px;
    padding: 4px 2px 10px 2px;
  }

  .error {
    color: #e88b8b;
    font-size: 13px;
    padding: 8px 0;
  }

  .toast {
    position: absolute;
    left: 50%;
    top: 8px;
    transform: translateX(-50%) translateY(0);
    background: var(--tmdb-surface-alt);
    border: 1px solid var(--tmdb-watched);
    color: var(--tmdb-text);
    font-size: 13px;
    font-weight: 600;
    padding: 10px 18px;
    border-radius: 999px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    opacity: 1;
    max-width: calc(100% - 32px);
    text-align: center;
    pointer-events: none;
    z-index: 20;
    transition: opacity 0.25s ease, transform 0.25s ease;
    animation: toast-in 0.2s ease;
  }
  .toast.toast-hide {
    opacity: 0;
    transform: translateX(-50%) translateY(-6px);
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .result-list, .season-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .result-list {
    padding-right: 4px;
  }

  .result-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--tmdb-surface);
    border: 1px solid var(--tmdb-border);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .poster {
    width: 42px;
    height: 60px;
    border-radius: 6px;
    object-fit: cover;
    background: var(--tmdb-surface-alt);
    flex-shrink: 0;
  }

  .result-info { flex: 1; min-width: 0; }
  .result-title { font-weight: 600; font-size: 14px; }
  .result-meta { color: var(--tmdb-text-muted); font-size: 12px; margin-top: 2px; }

  button.pill {
    background: var(--tmdb-accent-soft);
    color: var(--tmdb-accent);
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  button.pill:hover { border-color: var(--tmdb-accent); }
  button.pill:disabled { opacity: 0.5; cursor: default; }
  button.pill.danger { background: transparent; color: var(--tmdb-text-muted); }
  button.pill.danger:hover { color: #e88b8b; border-color: #e88b8b; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--poster-min, 120px), 1fr));
    gap: 14px;
    padding-right: 4px;
  }

  .series-card {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .series-card .poster {
    width: 100%;
    height: var(--poster-height, 168px);
    border-radius: 8px;
  }

  .poster-wrap { position: relative; }
  .series-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }

  /* Personen: grau = nicht gewählt, farbig = gewählt */
  .persons { display: flex; gap: 4px; }
  .poster-wrap .persons { position: absolute; top: 6px; left: 6px; }
  .persons-filter { align-items: center; gap: 8px; }
  .persons-label { font-size: 12px; color: var(--tmdb-text-muted); }
  .person {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    box-sizing: border-box;
    border: 2px solid #fff;
    background: var(--tmdb-surface-alt);
    color: var(--tmdb-text);
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 0;
    cursor: pointer;
    filter: grayscale(1);
    opacity: 0.75;
  }
  .person img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .person.on { filter: none; opacity: 1; border-color: var(--tmdb-accent); }
  .persons-filter .person, .detail-persons .person { width: 34px; height: 34px; }
  .detail-persons { margin-top: 10px; align-items: center; gap: 8px; }

  .list-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  .columns-switch { display: flex; gap: 4px; margin-left: auto; }
  .columns-switch button {
    background: var(--tmdb-surface-alt);
    color: var(--tmdb-text-muted);
    border: 1px solid var(--tmdb-border);
    border-radius: 6px;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .columns-switch button:hover { border-color: var(--tmdb-accent); }
  .columns-switch button.active { background: var(--tmdb-accent); color: var(--tmdb-bg); border-color: var(--tmdb-accent); }

  /* feste Spaltenzahl: Poster im Seitenverhältnis 2:3 statt fester Höhe */
  .grid.fixed .series-card .poster { height: auto; aspect-ratio: 2 / 3; }
  /* 1 Spalte: Listenansicht, Poster links, Text rechts */
  .grid.single .series-card { flex-direction: row; gap: 12px; }
  .grid.single .poster-wrap { width: 110px; flex-shrink: 0; }
  .grid.single .poster { cursor: zoom-in; }
  .series-overview {
    font-size: 12px;
    color: var(--tmdb-text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .poster-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: rgba(0, 0, 0, 0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    cursor: zoom-out;
  }
  .poster-overlay img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
  }

  .series-card .title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.25;
  }

  .status-badge {
    display: inline-block;
    align-self: flex-start;
    font-size: 10.5px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .status-badge.returning { background: rgba(79, 178, 134, 0.18); color: var(--tmdb-watched); }
  .status-badge.ended { background: rgba(139, 147, 167, 0.2); color: var(--tmdb-text-muted); }

  .available-badge {
    font-size: 10.5px;
    color: var(--tmdb-accent);
  }

  .archive-hint {
    color: var(--tmdb-accent);
    font-size: 12.5px;
    margin-top: 6px;
  }

  .progress-track {
    height: 4px;
    border-radius: 2px;
    background: var(--tmdb-surface-alt);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--tmdb-accent);
  }
  .progress-label {
    font-size: 11px;
    color: var(--tmdb-text-muted);
  }

  .empty {
    color: var(--tmdb-text-muted);
    font-size: 14px;
    padding: 20px 4px;
    text-align: center;
  }

  /* Detailansicht */
  .detail-header {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
  }
  .detail-header .poster { width: 120px; height: 180px; border-radius: 8px; cursor: zoom-in; }
  .detail-header .meta { flex: 1; min-width: 0; }
  .detail-header h2 {
    font-family: ${HEADLINE_FONT};
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 4px 0;
  }
  .back-link {
    color: var(--tmdb-text-muted);
    font-size: 13px;
    cursor: pointer;
    margin-bottom: 10px;
    display: inline-block;
  }
  .back-link:hover { color: var(--tmdb-accent); }

  .section-title {
    font-family: ${HEADLINE_FONT};
    font-size: 16px;
    font-weight: 700;
    margin: 18px 0 8px 0;
  }

  .provider-group { margin-bottom: 12px; }
  .provider-group .label {
    font-size: 12px;
    font-weight: 600;
    color: var(--tmdb-text-muted);
    margin-bottom: 6px;
  }
  .provider-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .provider-logo {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--tmdb-surface-alt);
    opacity: 0.45;
    border: 2px solid transparent;
  }
  .provider-logo.mine {
    opacity: 1;
    border-color: var(--tmdb-accent);
  }

  .provider-attribution {
    font-size: 10.5px;
    color: var(--tmdb-text-muted);
    margin-top: 4px;
  }
  .provider-attribution a { color: var(--tmdb-text-muted); }

  .season-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 2px;
    cursor: pointer;
  }
  .season-header .name {
    font-family: ${HEADLINE_FONT};
    font-size: 17px;
    font-weight: 700;
  }
  .season-header .count { color: var(--tmdb-text-muted); font-size: 12px; }

  .episode-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 7px 4px;
    border-top: 1px solid var(--tmdb-border);
  }
  .episode-row:first-child { border-top: none; }

  .episode-row input[type="checkbox"] {
    margin-top: 3px;
    width: 17px;
    height: 17px;
    accent-color: var(--tmdb-watched);
    cursor: pointer;
    flex-shrink: 0;
  }

  .episode-code {
    font-family: ${HEADLINE_FONT};
    font-weight: 700;
    color: var(--tmdb-accent);
    font-size: 13px;
    min-width: 52px;
  }

  .episode-name { font-size: 13.5px; flex: 1; }
  .episode-name.watched { color: var(--tmdb-text-muted); text-decoration: line-through; }
  .episode-aired { font-size: 12px; color: var(--tmdb-text-muted); white-space: nowrap; }

  .loading { color: var(--tmdb-text-muted); font-size: 14px; padding: 20px 4px; }

  .tmdb-attribution {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-top: 1px solid var(--tmdb-border);
    background: var(--tmdb-surface);
  }
  .tmdb-attribution img {
    height: 14px;
    width: auto;
    opacity: 0.85;
    flex-shrink: 0;
  }
  .tmdb-attribution span {
    color: var(--tmdb-text-muted);
    font-size: 10.5px;
    line-height: 1.4;
  }
  .tmdb-attribution a { color: var(--tmdb-text-muted); }
`;

class HaSeriesDbCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._activeTab = this._loadActiveTab();
    this._tracked = [];
    this._searchQuery = "";
    this._searchResults = null;
    this._searching = false;
    this._listFilter = "";
    this._selectedSeriesId = null;
    this._detail = null;
    this._settings = { region: "", providers: [], persons: [] };
    this._personFilter = null;
    this._posterOverlay = false;
    this._columns = null;
    this._collapsedSeasons = new Set();
    this._scrollToEpisodeId = null;
    this._error = null;
    this._successMessage = null;
    this._successTimeout = null;
    this._successFadeTimeout = null;
    this._initialized = false;
    this._searchDebounce = null;
  }

  setConfig(config) {
    this._config = config || {};
  }

  // Zuletzt gewählter Reiter wird rein lokal im Browser gemerkt (localStorage,
  // keine Übertragung an Dritte). Zugriff kann z.B. im privaten Modus
  // scheitern - dann startet die Karte einfach wie bisher bei "Meine Serien".
  _loadActiveTab() {
    try {
      const saved = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (TAB_IDS.includes(saved)) return saved;
    } catch {
      // ignorieren
    }
    return "mine";
  }

  _setActiveTab(tab) {
    this._activeTab = tab;
    try {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
    } catch {
      // ignorieren
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    loadExtraTable(detectLang(hass), () => this._render());
    if (!this._initialized) {
      this._initialized = true;
      this._render();
      this._loadTracked();
      this._loadSettings();
    }
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    // Erlaubt in der "Sections"-Ansicht das Anpassen von Breite UND Höhe per
    // Ziehen am Rand im Dashboard-Editor. Standard: volle Breite (12 Spalten),
    // 8 Zeilen. Die Karte füllt dank height:100% in der CSS (siehe :host)
    // tatsächlich die zugewiesene Zellenhöhe aus, anstatt nur mit ihrem
    // Inhalt zu wachsen - wie bei anderen Standard-Karten üblich.
    return {
      columns: 12,
      rows: 8,
      min_columns: 6,
      max_columns: 12,
      min_rows: 4,
      max_rows: 16,
    };
  }

  static getStubConfig() {
    return {};
  }

  static getConfigElement() {
    // Diese Karte hat keine Konfigurationsoptionen, deshalb reicht ein
    // leerer/minimaler Editor. Entscheidend ist aber, DASS überhaupt einer
    // vorhanden ist: Ohne getConfigElement() zeigt Home Assistant im
    // Karten-Editor-Dialog gar keine Tab-Leiste an (weder "Sichtbarkeit"
    // noch "Layout"), sondern nur eine reine YAML-Ansicht mit dem Hinweis
    // "Visueller Editor wird nicht unterstützt" - der Layout-Tab mit den
    // Größen-Schiebereglern (getGridOptions() oben) wird davon mit
    // ausgeblendet, obwohl er technisch unabhängig davon implementiert ist.
    return document.createElement("ha-seriesdb-card-editor");
  }

  async _callWS(payload) {
    return this._hass.callWS({ type: `${DOMAIN}/${payload.cmd}`, ...payload.args });
  }

  async _loadTracked() {
    try {
      const res = await this._hass.callWS({ type: `${DOMAIN}/list_tracked` });
      this._tracked = res.series || [];
      this._error = null;
    } catch (err) {
      this._error = this._t("err_load_list");
    }
    this._render();
  }

  async _loadSettings() {
    try {
      const res = await this._hass.callWS({ type: `${DOMAIN}/get_settings` });
      this._settings = res || { region: "", providers: [] };
    } catch (err) {
      // Einstellungen sind nur für die Hervorhebung wichtig - ein Fehler
      // hier soll die Karte nicht blockieren.
    }
    this._render();
  }

  _myProviderIds() {
    return new Set((this._settings.providers || []).map((p) => p.provider_id));
  }

  async _doSearch(query) {
    this._searching = true;
    this._render();
    try {
      const res = await this._hass.callWS({ type: `${DOMAIN}/search`, query });
      this._searchResults = res.results || [];
      this._error = null;
    } catch (err) {
      this._error = this._errText(err, "err_search");
      this._searchResults = [];
    }
    this._searching = false;
    this._render();
  }

  async _addSeries(seriesId) {
    this._error = null;
    try {
      const item = this._searchResults
        ? this._searchResults.find((r) => r.series_id === seriesId)
        : null;
      await this._hass.callWS({ type: `${DOMAIN}/add_series`, series_id: seriesId });
      await this._loadTracked();
      // Kurze Überblendung (Toast) anzeigen, bevor das Suchfeld geleert wird
      this._successMessage = this._t("added_toast", {
        title: item ? item.name : this._t("series_fallback"),
      });
      if (item) item.tracked = true;
      this._render();
      clearTimeout(this._successTimeout);
      clearTimeout(this._successFadeTimeout);
      // Fade-Out kurz vor Ablauf der Gesamtanzeigedauer von 1s anstoßen
      this._successFadeTimeout = setTimeout(() => {
        const toast = this.shadowRoot.querySelector(".toast");
        if (toast) toast.classList.add("toast-hide");
      }, 700);
      this._successTimeout = setTimeout(() => {
        this._successMessage = null;
        clearTimeout(this._searchDebounce);
        this._searchQuery = "";
        this._searchResults = null;
        this._render();
      }, 1000);
    } catch (err) {
      this._error = this._errText(err, "err_add");
      this._render();
    }
  }

  async _removeSeries(seriesId) {
    try {
      await this._hass.callWS({ type: `${DOMAIN}/remove_series`, series_id: seriesId });
    } catch (err) {
      this._error = this._errText(err, "err_remove");
    }
    if (this._selectedSeriesId === seriesId) {
      this._selectedSeriesId = null;
      this._detail = null;
    }
    await this._loadTracked();
  }

  async _openSeries(seriesId) {
    this._selectedSeriesId = seriesId;
    this._detail = null;
    this._collapsedSeasons = new Set();
    this._render();
    try {
      const res = await this._hass.callWS({ type: `${DOMAIN}/get_series`, series_id: seriesId });
      this._detail = res;
      this._error = null;
      // Staffeln, die bereits komplett gesehen sind, standardmäßig einklappen
      for (const [seasonNumber, episodes] of this._groupBySeason(res.episodes || [])) {
        if (episodes.length > 0 && episodes.every((e) => e.watched)) {
          this._collapsedSeasons.add(seasonNumber);
        }
      }
    } catch (err) {
      this._error = this._errText(err, "err_load_series");
    }
    this._render();

    // Verfügbarkeit gezielt auffrischen statt bis zu 12h alte Daten aus dem
    // Cache anzuzeigen, und die Einstellungen erneut laden, falls sich Region
    // oder eigene Anbieter seit dem letzten Öffnen der Karte geändert haben.
    this._loadSettings();
    try {
      const providers = await this._hass.callWS({
        type: `${DOMAIN}/get_watch_providers`,
        series_id: seriesId,
      });
      if (this._selectedSeriesId === seriesId && this._detail) {
        this._detail.watch_providers = providers;
        this._render();
      }
    } catch (err) {
      // Watch-Provider-Refresh ist optional - der zuvor gecachte Stand aus
      // get_series() bleibt sichtbar, falls er vorhanden ist.
    }
  }

  async _toggleEpisode(episodeId, watched) {
    if (!this._detail) return;
    const ep = this._detail.episodes.find((e) => e.episode_id === episodeId);
    if (ep) ep.watched = watched; // optimistisch
    this._render();
    try {
      await this._hass.callWS({
        type: `${DOMAIN}/toggle_episode`,
        series_id: this._selectedSeriesId,
        episode_id: episodeId,
        watched,
      });
    } catch (err) {
      if (ep) ep.watched = !watched; // zurückrollen
      this._error = this._errText(err, "err_episode");
      this._render();
    }
    this._loadTracked();
  }

  /**
   * Markiert eine Episode und alle vorherigen (nach Staffel-/Episodennummer)
   * als gesehen. Wird beim Anhaken einer Episode genutzt, damit man nicht
   * jede Folge einer Serie einzeln abhaken muss.
   */
  async _markWatchedUpTo(episodeId) {
    if (!this._detail) return;
    const target = this._detail.episodes.find((e) => e.episode_id === episodeId);
    if (!target) return;
    const targetKey = [target.season_number, target.episode_number];
    const isUpTo = (e) => {
      if (e.season_number !== targetKey[0]) return e.season_number < targetKey[0];
      return e.episode_number <= targetKey[1];
    };
    const changed = this._detail.episodes.filter((e) => isUpTo(e) && !e.watched);
    changed.forEach((e) => (e.watched = true)); // optimistisch

    // Vorherige Staffeln, die dadurch jetzt komplett gesehen sind, automatisch
    // einklappen (wie beim erstmaligen Öffnen der Serie) - die aktuelle
    // Staffel bleibt bewusst offen, damit die gerade angehakte Folge sichtbar
    // bleibt.
    for (const [seasonNumber, episodes] of this._groupBySeason(this._detail.episodes)) {
      if (seasonNumber >= targetKey[0]) continue;
      if (episodes.length > 0 && episodes.every((e) => e.watched)) {
        this._collapsedSeasons.add(seasonNumber);
      }
    }
    this._scrollToEpisodeId = episodeId;

    this._render();
    try {
      await this._hass.callWS({
        type: `${DOMAIN}/mark_watched_up_to`,
        series_id: this._selectedSeriesId,
        episode_id: episodeId,
      });
    } catch (err) {
      changed.forEach((e) => (e.watched = false)); // zurückrollen
      this._error = this._errText(err, "err_episodes");
      this._render();
    }
    this._loadTracked();
  }

  async _toggleSeason(seasonNumber, watched) {
    if (!this._detail) return;
    this._detail.episodes.forEach((ep) => {
      if (ep.season_number === seasonNumber) ep.watched = watched;
    });
    this._render();
    try {
      await this._hass.callWS({
        type: `${DOMAIN}/toggle_season`,
        series_id: this._selectedSeriesId,
        season_number: seasonNumber,
        watched,
      });
    } catch (err) {
      this._error = this._errText(err, "err_season");
    }
    this._loadTracked();
  }

  async _setArchived(seriesId, archived) {
    this._error = null;
    try {
      await this._hass.callWS({ type: `${DOMAIN}/set_archived`, series_id: seriesId, archived });
      if (this._detail && this._detail.series_id === seriesId) {
        this._detail.archived = archived;
      }
    } catch (err) {
      this._error = this._errText(err, "err_archived");
    }
    await this._loadTracked();
    this._render();
  }

  _t(key, vars) {
    return translate(detectLang(this._hass), key, vars);
  }

  _errText(err, fallbackKey) {
    const code = err && err.code;
    if (code === "not_configured") return this._t("err_not_configured");
    if (code === "not_found") return this._t("err_not_found");
    if (code === "tmdb_error") return this._t("err_tmdb");
    return this._t(fallbackKey);
  }

  _statusLabel(status) {
    const keys = {
      "Returning Series": "status_returning",
      "Planned": "status_planned",
      "In Production": "status_in_production",
      "Ended": "status_ended",
      "Canceled": "status_canceled",
      "Pilot": "status_pilot",
    };
    return keys[status] ? this._t(keys[status]) : status || "";
  }

  _isEndedStatus(status) {
    return status === "Ended" || status === "Canceled";
  }

  _groupBySeason(episodes) {
    const map = new Map();
    for (const ep of episodes) {
      const key = ep.season_number;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ep);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }

  _fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  }

  _render() {
    const root = this.shadowRoot;

    // Fokus + Cursorposition merken, damit ein Re-Render (z.B. während der
    // Live-Suche) nicht aus dem Eingabefeld herausspringt.
    const active = root.activeElement;
    let focusInfo = null;
    if (active && active.dataset && active.dataset.focusId) {
      focusInfo = {
        id: active.dataset.focusId,
        selectionStart: active.selectionStart,
        selectionEnd: active.selectionEnd,
      };
    }

    // Scroll-Position der Episodenliste merken: .body wird unten komplett
    // neu aufgebaut (siehe Kommentar dort), ein frisches Element startet
    // sonst immer bei scrollTop 0 - das ließ z.B. das Abhaken einer Folge
    // weit unten in einer langen Liste ganz nach oben springen.
    const oldBody = root.querySelector(".body");
    const savedScrollTop = oldBody ? oldBody.scrollTop : 0;

    // Den neuen Kartenzustand komplett losgelöst vom Dokument aufbauen (kein
    // einziges Element hängt währenddessen im Shadow-DOM). Das verhindert,
    // dass Browser-Erweiterungen mit eigenem MutationObserver (z.B. manche
    // Firefox-Add-ons) mitten in einer Kaskade kleinteiliger DOM-Änderungen
    // ins Straucheln geraten - stattdessen sehen sie am Ende nur einen
    // einzigen, atomaren Austausch.
    const card = this._el("div", "card");
    card.appendChild(this._renderHeader());
    card.appendChild(this._el("div", "sprocket-rule"));

    const body = this._el("div", "body");
    if (this._error) {
      const err = this._el("div", "error");
      err.textContent = this._error;
      body.appendChild(err);
    }

    if (this._selectedSeriesId) {
      body.appendChild(this._renderDetail());
    } else if (this._activeTab === "mine") {
      body.appendChild(this._renderMine());
    } else if (this._activeTab === "open") {
      body.appendChild(this._renderOpen());
    } else if (this._activeTab === "archive") {
      body.appendChild(this._renderArchive());
    } else {
      body.appendChild(this._renderSearch());
    }
    card.appendChild(body);
    card.appendChild(this._renderTmdbAttribution());
    if (this._posterOverlay) {
      const overlay = this._el("div", "poster-overlay");
      const big = document.createElement("img");
      // TMDB liefert das Bild auch in höherer Auflösung
      big.src = this._posterOverlay.replace("/w342/", "/w780/");
      overlay.appendChild(big);
      overlay.addEventListener("click", () => this._setPosterOverlay(false));
      card.appendChild(overlay);
    }

    if (this._successMessage) {
      const toast = this._el("div", "toast");
      toast.textContent = this._successMessage;
      body.appendChild(toast);
    }

    // Einziger Berührungspunkt mit dem echten Shadow-DOM: das Stylesheet
    // wird nur einmalig angelegt, die Karte selbst in einem Rutsch ersetzt.
    if (!this._styleEl) {
      this._styleEl = document.createElement("style");
      this._styleEl.textContent = STYLES;
      root.appendChild(this._styleEl);
    }
    const oldCard = root.querySelector(".card");
    if (oldCard) {
      oldCard.replaceWith(card);
    } else {
      root.appendChild(card);
    }

    // Gemerkte Scroll-Position wiederherstellen (siehe oben) - erst jetzt
    // möglich, da scrollTop bei einem noch nicht eingehängten Element immer
    // 0 bleibt.
    body.scrollTop = savedScrollTop;

    // Nach "Folge und alle vorherigen als gesehen markieren" ggf. explizit
    // zur angehakten Folge scrollen: dadurch eingeklappte, jetzt komplett
    // gesehene Staffeln oberhalb verschieben den Inhalt, die reine
    // Scroll-Position von oben würde also an der falschen Stelle landen.
    if (this._scrollToEpisodeId != null) {
      const targetRow = body.querySelector(`[data-episode-id="${this._scrollToEpisodeId}"]`);
      if (targetRow) targetRow.scrollIntoView({ block: "nearest" });
      this._scrollToEpisodeId = null;
    }

    if (focusInfo) {
      const toFocus = root.querySelector(`[data-focus-id="${focusInfo.id}"]`);
      if (toFocus) {
        toFocus.focus();
        try {
          toFocus.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
        } catch {
          // manche Input-Typen unterstützen setSelectionRange nicht - egal
        }
      }
    }
  }

  _renderHeader() {
    const wrap = this._el("div");
    const header = this._el("div", "header");
    const titleRow = this._el("div", "header-title");
    const icon = document.createElement("img");
    icon.src = `/${DOMAIN}/ha-seriesdb-icon.png`;
    icon.alt = "";
    titleRow.appendChild(icon);
    const h1 = this._el("h1");
    h1.textContent = "HA SeriesDB";
    titleRow.appendChild(h1);
    header.appendChild(titleRow);
    wrap.appendChild(header);

    if (!this._selectedSeriesId) {
      const withCount = (label, n) => `${label}${n ? " (" + n + ")" : ""}`;
      const activeCount = this._tracked.filter((s) => !s.archived).length;
      const openCount = this._tracked.filter((s) => this._isOpen(s)).length;
      const archivedCount = this._tracked.filter((s) => s.archived).length;

      const tabDefs = [
        ["mine", withCount(this._t("tab_mine"), activeCount)],
        ["open", withCount(this._t("tab_open"), openCount)],
        ["archive", withCount(this._t("tab_archive"), archivedCount)],
        ["search", this._t("tab_search")],
      ];
      const tabs = this._el("div", "tabs");
      for (const [id, label] of tabDefs) {
        const tab = this._el("div", "tab" + (this._activeTab === id ? " active" : ""));
        tab.textContent = label;
        tab.addEventListener("click", () => this._setActiveTab(id));
        tabs.appendChild(tab);
      }
      wrap.appendChild(tabs);
    }
    return wrap;
  }

  _renderMine() {
    return this._renderSeriesGrid(
      this._tracked.filter((s) => !s.archived),
      this._t("empty_mine")
    );
  }

  _isOpen(s) {
    return !s.archived && (s.open_episodes || 0) > 0;
  }

  _renderOpen() {
    return this._renderSeriesGrid(
      this._tracked.filter((s) => this._isOpen(s)),
      this._t("empty_open")
    );
  }

  _renderArchive() {
    return this._renderSeriesGrid(
      this._tracked.filter((s) => s.archived),
      this._t("empty_archive")
    );
  }

  // Personen werden nur angezeigt, wenn im Options-Dialog mehr als eine gewählt ist.
  _persons() {
    const list = (this._settings && this._settings.persons) || [];
    return list.length > 1 ? list : [];
  }

  async _togglePerson(seriesId, entityId) {
    const series = this._tracked.find((x) => x.series_id === seriesId);
    const current =
      (series && series.persons) ||
      (this._detail && this._detail.series_id === seriesId ? this._detail.persons : []) ||
      [];
    const next = current.includes(entityId)
      ? current.filter((p) => p !== entityId)
      : [...current, entityId];
    try {
      const res = await this._hass.callWS({ type: `${DOMAIN}/set_persons`, series_id: seriesId, persons: next });
      if (series) series.persons = res.persons;
      if (this._detail && this._detail.series_id === seriesId) this._detail.persons = res.persons;
      this._error = null;
    } catch (err) {
      this._error = this._errText(err, "err_persons");
    }
    this._render();
  }

  _renderPersonAvatars(selected, onToggle, extraClass = "") {
    const row = this._el("div", `persons ${extraClass}`.trim());
    for (const p of this._persons()) {
      const btn = this._el("div", "person" + (selected.includes(p.entity_id) ? " on" : ""));
      btn.title = p.name;
      if (p.picture) {
        const img = document.createElement("img");
        img.src = p.picture;
        img.alt = p.name;
        btn.appendChild(img);
      } else {
        btn.textContent = (p.name || "?").trim().charAt(0).toUpperCase();
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onToggle(p.entity_id);
      });
      row.appendChild(btn);
    }
    return row;
  }

  // Spaltenwahl: Auswahl am Gerät (localStorage) vor der Kartenoption `columns`.
  _getColumns() {
    if (this._columns === null) {
      let stored = null;
      try {
        stored = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
      } catch {
        // localStorage nicht verfügbar - egal
      }
      const configured = this._config.columns === undefined ? "auto" : String(this._config.columns);
      this._columns = COLUMN_CHOICES.includes(stored) ? stored : COLUMN_CHOICES.includes(configured) ? configured : "auto";
    }
    return this._columns;
  }

  _setColumns(value) {
    this._columns = value;
    try {
      window.localStorage.setItem(COLUMNS_STORAGE_KEY, value);
    } catch {
      // nicht schlimm, die Wahl gilt dann nur bis zum Neuladen
    }
    this._render();
  }

  _renderColumnsSwitch() {
    const box = this._el("div", "columns-switch");
    box.title = this._t("columns_label");
    for (const choice of COLUMN_CHOICES) {
      const btn = document.createElement("button");
      btn.textContent = choice === "auto" ? this._t("columns_auto") : choice;
      btn.title = `${this._t("columns_label")}: ${btn.textContent}`;
      if (this._getColumns() === choice) btn.className = "active";
      btn.addEventListener("click", () => this._setColumns(choice));
      box.appendChild(btn);
    }
    return box;
  }

  // `image`: URL des Posters, das vergrößert werden soll - false schließt das Overlay.
  _setPosterOverlay(image) {
    this._posterOverlay = image;
    if (image) {
      this._onKeydown = (e) => {
        if (e.key === "Escape") this._setPosterOverlay(false);
      };
      document.addEventListener("keydown", this._onKeydown);
    } else if (this._onKeydown) {
      document.removeEventListener("keydown", this._onKeydown);
      this._onKeydown = null;
    }
    this._render();
  }

  _renderSeriesGrid(list, emptyText) {
    const wrap = this._el("div");
    if (!list.length) {
      const empty = this._el("div", "empty");
      empty.textContent = emptyText;
      wrap.appendChild(empty);
      return wrap;
    }

    // Filter über alle Listen hinweg geteilt (Titel, ohne Groß-/Kleinschreibung)
    // Nur bei langen Listen (oder aktivem Filter, damit er sichtbar bleibt)
    if (list.length > LIST_FILTER_MIN_ITEMS || this._listFilter) {
      const row = this._el("div", "search-row");
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = this._t("filter_placeholder");
      input.value = this._listFilter;
      input.dataset.focusId = "list-filter";
      input.addEventListener("input", (e) => {
        this._listFilter = e.target.value;
        this._render();
      });
      row.appendChild(input);
      wrap.appendChild(row);
    }

    const toolbar = this._el("div", "list-toolbar");
    if (this._persons().length) {
      toolbar.appendChild(
        this._renderPersonAvatars(
          this._personFilter ? [this._personFilter] : [],
          (id) => {
            this._personFilter = this._personFilter === id ? null : id;
            this._render();
          },
          "persons-filter"
        )
      );
    }
    toolbar.appendChild(this._renderColumnsSwitch());
    wrap.appendChild(toolbar);

    const needle = this._listFilter.trim().toLowerCase();
    if (needle) {
      list = list.filter((s) => (s.name || "").toLowerCase().includes(needle));
    }
    if (this._personFilter) {
      list = list.filter((s) => (s.persons || []).includes(this._personFilter));
    }
    if (!list.length) {
      const empty = this._el("div", "empty");
      empty.textContent = this._t("no_filter_results");
      wrap.appendChild(empty);
      return wrap;
    }
    const grid = this._el("div", "grid");
    const columns = this._getColumns();
    if (columns === "auto") {
      const size = POSTER_SIZES[this._config.poster_size] || POSTER_SIZES.small;
      grid.style.setProperty("--poster-min", `${size.min}px`);
      grid.style.setProperty("--poster-height", `${size.height}px`);
    } else {
      grid.classList.add("fixed");
      if (columns === "1") grid.classList.add("single");
      grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    }
    for (const s of list) {
      const total = s.total_episodes || 0;
      const watched = s.watched_episodes || 0;
      const pct = total ? Math.round((watched / total) * 100) : 0;

      const cardEl = this._el("div", "series-card");
      cardEl.addEventListener("click", () => this._openSeries(s.series_id));

      const posterWrap = this._el("div", "poster-wrap");
      const img = document.createElement("img");
      img.className = "poster";
      img.loading = "lazy";
      if (s.image) img.src = s.image;
      posterWrap.appendChild(img);
      if (columns === "1" && s.image) {
        // Listenansicht: Klick auf das Poster vergrößert es, der Rest der Kachel öffnet die Details
        img.title = this._t("poster_enlarge");
        img.addEventListener("click", (e) => {
          e.stopPropagation();
          this._setPosterOverlay(s.image);
        });
      }
      if (this._persons().length) {
        posterWrap.appendChild(
          this._renderPersonAvatars(s.persons || [], (id) => this._togglePerson(s.series_id, id))
        );
      }
      cardEl.appendChild(posterWrap);

      const info = this._el("div", "series-info");
      const title = this._el("div", "title");
      title.textContent = s.name || s.series_id;
      info.appendChild(title);

      if (s.status) {
        const badge = this._el(
          "div",
          "status-badge " + (this._isEndedStatus(s.status) ? "ended" : "returning")
        );
        badge.textContent = this._statusLabel(s.status);
        info.appendChild(badge);
      }

      if (s.available_on && s.available_on.length) {
        const avail = this._el("div", "available-badge");
        avail.textContent = this._t("available", { list: s.available_on.join(", ") });
        info.appendChild(avail);
      }

      if (columns === "1" && s.overview) {
        const overview = this._el("div", "series-overview");
        overview.textContent = s.overview;
        info.appendChild(overview);
      }

      const track = this._el("div", "progress-track");
      const fill = this._el("div", "progress-fill");
      fill.style.width = pct + "%";
      track.appendChild(fill);
      info.appendChild(track);

      const label = this._el("div", "progress-label");
      label.textContent = this._t("episodes_progress", { watched, total });
      info.appendChild(label);
      cardEl.appendChild(info);

      grid.appendChild(cardEl);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  _renderSearch() {
    const wrap = this._el("div");
    const row = this._el("div", "search-row");
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = this._t("search_placeholder");
    input.value = this._searchQuery;
    input.dataset.focusId = "search-input";
    input.addEventListener("input", (e) => {
      this._searchQuery = e.target.value;
      clearTimeout(this._searchDebounce);
      const q = this._searchQuery.trim();
      this._searchDebounce = setTimeout(() => {
        if (q.length < 2) {
          this._searchResults = null;
          this._render();
        } else {
          this._doSearch(q);
        }
      }, 500);
    });
    row.appendChild(input);
    wrap.appendChild(row);

    const hint = this._el("div", "hint");
    hint.textContent = this._t("data_source");
    wrap.appendChild(hint);

    if (this._searching) {
      const loading = this._el("div", "loading");
      loading.textContent = this._t("searching");
      wrap.appendChild(loading);
      return wrap;
    }

    if (this._searchResults === null) {
      return wrap;
    }

    if (!this._searchResults.length) {
      const empty = this._el("div", "empty");
      empty.textContent = this._t("no_results");
      wrap.appendChild(empty);
      return wrap;
    }

    const list = this._el("div", "result-list");
    for (const r of this._searchResults) {
      const row2 = this._el("div", "result-row");
      const img = document.createElement("img");
      img.className = "poster";
      img.loading = "lazy";
      if (r.image) img.src = r.image;
      row2.appendChild(img);

      const info = this._el("div", "result-info");
      const t = this._el("div", "result-title");
      t.textContent = r.name;
      const m = this._el("div", "result-meta");
      m.textContent = [r.year, r.network, r.status].filter(Boolean).join(" · ");
      info.appendChild(t);
      info.appendChild(m);
      row2.appendChild(info);

      const btn = document.createElement("button");
      btn.className = "pill";
      if (r.tracked) {
        btn.textContent = this._t("added");
        btn.disabled = true;
      } else {
        btn.textContent = this._t("add");
        btn.addEventListener("click", () => this._addSeries(r.series_id));
      }
      row2.appendChild(btn);

      list.appendChild(row2);
    }
    wrap.appendChild(list);
    return wrap;
  }

  _renderDetail() {
    const wrap = this._el("div");
    const back = this._el("div", "back-link");
    back.textContent = this._t("back");
    back.addEventListener("click", () => {
      this._selectedSeriesId = null;
      this._detail = null;
      this._render();
    });
    wrap.appendChild(back);

    if (!this._detail) {
      const loading = this._el("div", "loading");
      loading.textContent = this._t("loading_series");
      wrap.appendChild(loading);
      return wrap;
    }

    const d = this._detail;
    const header = this._el("div", "detail-header");
    const img = document.createElement("img");
    img.className = "poster";
    if (d.image) {
      img.src = d.image;
      img.title = this._t("poster_enlarge");
      img.addEventListener("click", () => this._setPosterOverlay(d.image));
    }
    header.appendChild(img);

    const meta = this._el("div", "meta");
    const h2 = this._el("h2");
    h2.textContent = d.name;
    meta.appendChild(h2);
    const metaLine = this._el("div", "result-meta");
    metaLine.textContent = [d.network, this._statusLabel(d.status)].filter(Boolean).join(" · ");
    meta.appendChild(metaLine);

    const totalEpisodes = (d.episodes || []).length;
    const watchedEpisodes = (d.episodes || []).filter((e) => e.watched).length;
    const eligibleForArchive =
      totalEpisodes > 0 &&
      watchedEpisodes === totalEpisodes &&
      this._isEndedStatus(d.status) &&
      !d.archived;
    if (eligibleForArchive) {
      const hint = this._el("div", "archive-hint");
      hint.textContent = this._t("archive_hint");
      meta.appendChild(hint);
    }

    const btnRow = this._el("div");
    btnRow.style.display = "flex";
    btnRow.style.flexWrap = "wrap";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "8px";

    const archiveBtn = document.createElement("button");
    archiveBtn.className = "pill";
    archiveBtn.textContent = d.archived ? this._t("unarchive") : this._t("archive");
    archiveBtn.addEventListener("click", () => this._setArchived(d.series_id, !d.archived));
    btnRow.appendChild(archiveBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className = "pill danger";
    removeBtn.textContent = this._t("remove");
    removeBtn.addEventListener("click", () => this._removeSeries(d.series_id));
    btnRow.appendChild(removeBtn);

    meta.appendChild(btnRow);

    if (this._persons().length) {
      const personsRow = this._el("div", "persons detail-persons");
      const label = this._el("span", "persons-label");
      label.textContent = this._t("persons_for");
      personsRow.appendChild(label);
      personsRow.appendChild(
        this._renderPersonAvatars(d.persons || [], (id) => this._togglePerson(d.series_id, id))
      );
      meta.appendChild(personsRow);
    }

    header.appendChild(meta);
    wrap.appendChild(header);

    wrap.appendChild(this._renderWatchProviders(d.watch_providers));

    const seasons = this._groupBySeason(d.episodes || []);
    const seasonList = this._el("div", "season-list");
    for (const [seasonNumber, episodes] of seasons) {
      const watchedCount = episodes.filter((e) => e.watched).length;
      const allWatched = watchedCount === episodes.length;
      const collapsed = this._collapsedSeasons.has(seasonNumber);

      const seasonBlock = this._el("div");
      const sHeader = this._el("div", "season-header");
      const name = this._el("div", "name");
      name.textContent =
        (seasonNumber === 0
          ? this._t("season_specials")
          : this._t("season_n", { n: seasonNumber })) + (collapsed ? " ›" : " ⌄");
      sHeader.appendChild(name);

      const right = this._el("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";
      const count = this._el("div", "count");
      count.textContent = `${watchedCount} / ${episodes.length}`;
      right.appendChild(count);

      const seasonBtn = document.createElement("button");
      seasonBtn.className = "pill";
      seasonBtn.textContent = allWatched ? this._t("season_reset") : this._t("season_all");
      seasonBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const markWatched = !allWatched;
        if (markWatched) {
          // Beim Markieren als "alle gesehen" die Staffel direkt einklappen
          this._collapsedSeasons.add(seasonNumber);
        } else {
          // Beim Zurücksetzen die Staffel wieder aufklappen
          this._collapsedSeasons.delete(seasonNumber);
        }
        this._toggleSeason(seasonNumber, markWatched);
      });
      right.appendChild(seasonBtn);
      sHeader.appendChild(right);

      sHeader.addEventListener("click", () => {
        if (collapsed) this._collapsedSeasons.delete(seasonNumber);
        else this._collapsedSeasons.add(seasonNumber);
        this._render();
      });
      seasonBlock.appendChild(sHeader);

      if (!collapsed) {
        for (const ep of episodes.sort((a, b) => a.episode_number - b.episode_number)) {
          const row = this._el("div", "episode-row");
          row.dataset.episodeId = String(ep.episode_id);
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!ep.watched;
          cb.addEventListener("change", () => {
            if (cb.checked) {
              this._markWatchedUpTo(ep.episode_id);
            } else {
              this._toggleEpisode(ep.episode_id, false);
            }
          });
          row.appendChild(cb);

          const code = this._el("div", "episode-code");
          code.textContent = `S${String(seasonNumber).padStart(2, "0")}E${String(
            ep.episode_number
          ).padStart(2, "0")}`;
          row.appendChild(code);

          const name2 = this._el("div", "episode-name" + (ep.watched ? " watched" : ""));
          name2.textContent = ep.name;
          if (ep.overview) name2.title = ep.overview;
          row.appendChild(name2);

          const aired = this._el("div", "episode-aired");
          aired.textContent = this._fmtDate(ep.aired);
          row.appendChild(aired);

          seasonBlock.appendChild(row);
        }
      }
      seasonList.appendChild(seasonBlock);
    }
    wrap.appendChild(seasonList);

    const backBottom = this._el("div", "back-link");
    backBottom.style.marginTop = "16px";
    backBottom.textContent = this._t("back");
    backBottom.addEventListener("click", () => {
      this._selectedSeriesId = null;
      this._detail = null;
      this._render();
    });
    wrap.appendChild(backBottom);

    return wrap;
  }

  _renderWatchProviders(providers) {
    const wrap = this._el("div");
    const title = this._el("div", "section-title");
    title.textContent = this._t("available_on_title");
    wrap.appendChild(title);

    if (!providers) {
      const loading = this._el("div", "loading");
      loading.textContent = this._t("loading_availability");
      wrap.appendChild(loading);
      return wrap;
    }

    const myIds = this._myProviderIds();
    let hasAny = false;
    for (const category of PROVIDER_CATEGORY_ORDER) {
      const list = providers[category] || [];
      if (!list.length) continue;
      hasAny = true;

      const group = this._el("div", "provider-group");
      const label = this._el("div", "label");
      label.textContent = this._t("cat_" + category);
      group.appendChild(label);

      const row = this._el("div", "provider-row");
      for (const p of list) {
        const logo = document.createElement("img");
        logo.className = "provider-logo" + (myIds.has(p.provider_id) ? " mine" : "");
        logo.title = p.provider_name;
        logo.alt = p.provider_name;
        if (p.logo_path) logo.src = p.logo_path;
        row.appendChild(logo);
      }
      group.appendChild(row);
      wrap.appendChild(group);
    }

    if (!hasAny) {
      const empty = this._el("div", "empty");
      empty.textContent = this._settings.region
        ? this._t("no_availability_region", { region: this._settings.region })
        : this._t("no_availability");
      wrap.appendChild(empty);
    }

    if (myIds.size === 0) {
      const hint = this._el("div", "hint");
      hint.textContent = this._t("hint_providers");
      wrap.appendChild(hint);
    }

    // Pflicht-Attribution laut TMDB Watch-Provider-API-Nutzungsbedingungen
    // (https://developer.themoviedb.org/docs/watch-providers-attribution-requirement):
    // Die Verfügbarkeitsdaten stammen von JustWatch und werden über TMDB
    // durchgereicht.
    const attribution = this._el("div", "provider-attribution");
    if (providers.link) {
      const link = document.createElement("a");
      link.href = providers.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = this._t("all_options_link");
      attribution.appendChild(link);
      attribution.append(this._t("attribution_suffix"));
    } else {
      attribution.textContent = this._t("attribution_only");
    }
    wrap.appendChild(attribution);

    return wrap;
  }

  _renderTmdbAttribution() {
    // Pflichthinweis laut TMDB API-Nutzungsbedingungen
    // (https://www.themoviedb.org/api-terms-of-use): Text + Logo, weniger
    // prominent als das eigene App-Logo im Header (siehe dort: 34px Icon
    // + 24px Titel vs. hier 14px Logo + 10.5px Text).
    const wrap = this._el("div", "tmdb-attribution");
    const logo = document.createElement("img");
    // /local/ = <config>/www/ liegt außerhalb von custom_components und
    // übersteht HACS-Updates; der alte Ablageort bleibt als Fallback.
    const sources = [
      `/local/${DOMAIN}/tmdb-logo.svg`,
      `/local/${DOMAIN}/tmdb-logo.png`,
      `/${DOMAIN}/tmdb-logo.svg`,
    ];
    let sourceIndex = 0;
    logo.alt = "TMDB";
    // Falls die Logo-Datei noch nirgends hinterlegt wurde, blenden wir sie
    // einfach aus statt ein kaputtes Bild anzuzeigen.
    logo.addEventListener("error", () => {
      sourceIndex += 1;
      if (sourceIndex < sources.length) {
        logo.src = sources[sourceIndex];
      } else {
        logo.style.display = "none";
      }
    });
    logo.src = sources[0];
    wrap.appendChild(logo);

    const text = document.createElement("span");
    const link = document.createElement("a");
    link.href = "https://www.themoviedb.org/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "TMDB";
    text.append(
      "This product uses the TMDB API but is not endorsed or certified by ",
      link,
      "."
    );
    wrap.appendChild(text);
    return wrap;
  }

  _el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }
}

// Minimaler Konfigurations-Editor: Optionen sind `columns` und `poster_size`.
// Wichtig ist vor allem, DASS die Klasse existiert - siehe Kommentar bei
// getConfigElement() oben.
class HaSeriesDbCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    loadExtraTable(detectLang(hass), () => this._updateText());
    this._updateText();
  }

  _updateText() {
    const root = this.shadowRoot;
    if (!root) return;
    const lang = detectLang(this._hass);
    root.querySelector("p").textContent = translate(lang, "editor_text");
    for (const label of root.querySelectorAll("label")) {
      const key = label.dataset.key;
      label.firstChild.textContent = translate(lang, `${key}_label`) + " ";
      const select = label.querySelector("select");
      for (const option of select.options) {
        option.textContent =
          key === "columns" && option.value !== "auto"
            ? option.value
            : translate(lang, `${key}_${option.value}`);
      }
      const choices = key === "columns" ? COLUMN_CHOICES : Object.keys(POSTER_SIZES);
      const current = this._config[key] === undefined ? "" : String(this._config[key]);
      select.value = choices.includes(current) ? current : choices[0];
    }
  }

  _render() {
    if (this.shadowRoot) {
      this._updateText();
      return;
    }
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        p, label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          font-size: 14px;
          color: var(--secondary-text-color, #6b7280);
          padding: 8px 4px;
          margin: 0;
          display: block;
        }
        select { font-size: 14px; margin-left: 6px; }
      </style>
      <p></p>
      <label data-key="columns">x <select>
        ${COLUMN_CHOICES.map((c) => `<option value="${c}"></option>`).join("")}
      </select></label>
      <label data-key="poster_size">x <select>
        ${Object.keys(POSTER_SIZES).map((c) => `<option value="${c}"></option>`).join("")}
      </select></label>
    `;
    for (const label of root.querySelectorAll("label")) {
      const key = label.dataset.key;
      label.querySelector("select").addEventListener("change", (e) => {
        const config = { ...this._config };
        const isDefault = e.target.value === (key === "columns" ? "auto" : "small");
        if (isDefault) delete config[key];
        else config[key] = key === "columns" ? Number(e.target.value) : e.target.value;
        this._config = config;
        this.dispatchEvent(
          new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true })
        );
      });
    }
    this._updateText();
  }
}
if (!customElements.get("ha-seriesdb-card-editor")) {
  customElements.define("ha-seriesdb-card-editor", HaSeriesDbCardEditor);
}

// Absicherung: Falls das Skript aus irgendeinem Grund mehrfach im selben
// Browser-Tab landet (z.B. Reste aus einer älteren, noch nicht bereinigten
// Registrierung nach einem Update ohne kompletten HA-Neustart), würde ein
// zweiter customElements.define()-Aufruf für denselben Namen einen fatalen,
// nicht abfangbaren Fehler auslösen und im schlimmsten Fall die ganze
// Dashboard-Seite zum Absturz bringen. Deshalb hier defensiv prüfen.
if (!customElements.get("ha-seriesdb-card")) {
  customElements.define("ha-seriesdb-card", HaSeriesDbCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "ha-seriesdb-card")) {
  window.customCards.push({
    type: "ha-seriesdb-card",
    name: "HA SeriesDB",
    description: translate(detectLang(null), "card_description"),
    preview: false,
  });
}
})();

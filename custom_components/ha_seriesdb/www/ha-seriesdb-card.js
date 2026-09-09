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
    display: block;
    font-family: ${BODY_FONT};
    color: var(--tmdb-text);
  }

  .card {
    position: relative;
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
  }

  .tab {
    padding: 10px 4px;
    margin-right: 20px;
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
    padding: 16px 20px 20px 20px;
    min-height: 120px;
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
    max-height: 420px;
    overflow-y: auto;
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
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 14px;
    max-height: 480px;
    overflow-y: auto;
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
    height: 168px;
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
  .detail-header .poster { width: 70px; height: 100px; }
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
    this._activeTab = "mine";
    this._tracked = [];
    this._searchQuery = "";
    this._searchResults = null;
    this._searching = false;
    this._selectedSeriesId = null;
    this._detail = null;
    this._collapsedSeasons = new Set();
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

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this._render();
      this._loadTracked();
    }
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    // Erlaubt in der "Sections"-Ansicht das Anpassen der Kartenbreite per
    // Ziehen am Rand im Dashboard-Editor. Standard: volle Breite (12 Spalten).
    return {
      columns: 12,
      rows: 8,
      min_columns: 6,
      max_columns: 12,
      min_rows: 4,
    };
  }

  static getStubConfig() {
    return {};
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
      this._error = "Konnte Watchlist nicht laden. Ist die Integration eingerichtet?";
    }
    this._render();
  }

  async _doSearch(query) {
    this._searching = true;
    this._render();
    try {
      const res = await this._hass.callWS({ type: `${DOMAIN}/search`, query });
      this._searchResults = res.results || [];
      this._error = null;
    } catch (err) {
      this._error = err.message || "Suche fehlgeschlagen.";
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
      this._successMessage = `„${item ? item.name : "Serie"}" wurde zur Watchlist hinzugefügt.`;
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
      this._error = err.message || "Serie konnte nicht hinzugefügt werden.";
      this._render();
    }
  }

  async _removeSeries(seriesId) {
    try {
      await this._hass.callWS({ type: `${DOMAIN}/remove_series`, series_id: seriesId });
    } catch (err) {
      this._error = err.message || "Serie konnte nicht entfernt werden.";
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
      this._error = err.message || "Serie konnte nicht geladen werden.";
    }
    this._render();
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
      this._error = err.message || "Konnte Episode nicht aktualisieren.";
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
    this._render();
    try {
      await this._hass.callWS({
        type: `${DOMAIN}/mark_watched_up_to`,
        series_id: this._selectedSeriesId,
        episode_id: episodeId,
      });
    } catch (err) {
      changed.forEach((e) => (e.watched = false)); // zurückrollen
      this._error = err.message || "Konnte Episoden nicht aktualisieren.";
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
      this._error = err.message || "Konnte Staffel nicht aktualisieren.";
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
      this._error = err.message || "Konnte Archivstatus nicht ändern.";
    }
    await this._loadTracked();
    this._render();
  }

  _statusLabel(status) {
    const labels = {
      "Returning Series": "Wiederkehrend",
      "Planned": "Geplant",
      "In Production": "In Produktion",
      "Ended": "Beendet",
      "Canceled": "Abgesetzt",
      "Pilot": "Pilotfolge",
    };
    return labels[status] || status || "";
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
    } else if (this._activeTab === "archive") {
      body.appendChild(this._renderArchive());
    } else {
      body.appendChild(this._renderSearch());
    }
    card.appendChild(body);
    card.appendChild(this._renderTmdbAttribution());

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
      const activeCount = this._tracked.filter((s) => !s.archived).length;
      const archivedCount = this._tracked.filter((s) => s.archived).length;

      const tabs = this._el("div", "tabs");
      const tabMine = this._el("div", "tab" + (this._activeTab === "mine" ? " active" : ""));
      tabMine.textContent = `Meine Serien${activeCount ? " (" + activeCount + ")" : ""}`;
      tabMine.addEventListener("click", () => {
        this._activeTab = "mine";
        this._render();
      });
      const tabArchive = this._el("div", "tab" + (this._activeTab === "archive" ? " active" : ""));
      tabArchive.textContent = `Archiv${archivedCount ? " (" + archivedCount + ")" : ""}`;
      tabArchive.addEventListener("click", () => {
        this._activeTab = "archive";
        this._render();
      });
      const tabSearch = this._el("div", "tab" + (this._activeTab === "search" ? " active" : ""));
      tabSearch.textContent = "Serie hinzufügen";
      tabSearch.addEventListener("click", () => {
        this._activeTab = "search";
        this._render();
      });
      tabs.appendChild(tabMine);
      tabs.appendChild(tabArchive);
      tabs.appendChild(tabSearch);
      wrap.appendChild(tabs);
    }
    return wrap;
  }

  _renderMine() {
    return this._renderSeriesGrid(
      this._tracked.filter((s) => !s.archived),
      "Noch keine Serien in der Watchlist. Wechsle oben zu „Serie hinzufügen“, um loszulegen."
    );
  }

  _renderArchive() {
    return this._renderSeriesGrid(
      this._tracked.filter((s) => s.archived),
      "Noch keine archivierten Serien. Du kannst eine Serie in ihrer Detailansicht archivieren, sobald sie komplett gesehen ist."
    );
  }

  _renderSeriesGrid(list, emptyText) {
    const wrap = this._el("div");
    if (!list.length) {
      const empty = this._el("div", "empty");
      empty.textContent = emptyText;
      wrap.appendChild(empty);
      return wrap;
    }
    const grid = this._el("div", "grid");
    for (const s of list) {
      const total = s.total_episodes || 0;
      const watched = s.watched_episodes || 0;
      const pct = total ? Math.round((watched / total) * 100) : 0;

      const cardEl = this._el("div", "series-card");
      cardEl.addEventListener("click", () => this._openSeries(s.series_id));

      const img = document.createElement("img");
      img.className = "poster";
      img.loading = "lazy";
      if (s.image) img.src = s.image;
      cardEl.appendChild(img);

      const title = this._el("div", "title");
      title.textContent = s.name || s.series_id;
      cardEl.appendChild(title);

      if (s.status) {
        const badge = this._el(
          "div",
          "status-badge " + (this._isEndedStatus(s.status) ? "ended" : "returning")
        );
        badge.textContent = this._statusLabel(s.status);
        cardEl.appendChild(badge);
      }

      const track = this._el("div", "progress-track");
      const fill = this._el("div", "progress-fill");
      fill.style.width = pct + "%";
      track.appendChild(fill);
      cardEl.appendChild(track);

      const label = this._el("div", "progress-label");
      label.textContent = `${watched} / ${total} Episoden`;
      cardEl.appendChild(label);

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
    input.placeholder = "Serientitel eingeben …";
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
    hint.textContent = "Datenquelle: themoviedb.org (kostenlose API)";
    wrap.appendChild(hint);

    if (this._searching) {
      const loading = this._el("div", "loading");
      loading.textContent = "Suche läuft …";
      wrap.appendChild(loading);
      return wrap;
    }

    if (this._searchResults === null) {
      return wrap;
    }

    if (!this._searchResults.length) {
      const empty = this._el("div", "empty");
      empty.textContent = "Keine Treffer.";
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
        btn.textContent = "Hinzugefügt";
        btn.disabled = true;
      } else {
        btn.textContent = "Hinzufügen";
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
    back.textContent = "‹ Zurück zur Übersicht";
    back.addEventListener("click", () => {
      this._selectedSeriesId = null;
      this._detail = null;
      this._render();
    });
    wrap.appendChild(back);

    if (!this._detail) {
      const loading = this._el("div", "loading");
      loading.textContent = "Lade Serie …";
      wrap.appendChild(loading);
      return wrap;
    }

    const d = this._detail;
    const header = this._el("div", "detail-header");
    const img = document.createElement("img");
    img.className = "poster";
    if (d.image) img.src = d.image;
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
      hint.textContent = "Komplett gesehen und abgeschlossen – jetzt archivieren?";
      meta.appendChild(hint);
    }

    const btnRow = this._el("div");
    btnRow.style.display = "flex";
    btnRow.style.flexWrap = "wrap";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "8px";

    const archiveBtn = document.createElement("button");
    archiveBtn.className = "pill";
    archiveBtn.textContent = d.archived ? "Aus Archiv zurückholen" : "Archivieren";
    archiveBtn.addEventListener("click", () => this._setArchived(d.series_id, !d.archived));
    btnRow.appendChild(archiveBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className = "pill danger";
    removeBtn.textContent = "Aus Watchlist entfernen";
    removeBtn.addEventListener("click", () => this._removeSeries(d.series_id));
    btnRow.appendChild(removeBtn);

    meta.appendChild(btnRow);

    header.appendChild(meta);
    wrap.appendChild(header);

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
        (seasonNumber === 0 ? "Specials" : `Staffel ${seasonNumber}`) + (collapsed ? " ›" : " ⌄");
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
      seasonBtn.textContent = allWatched ? "Alle zurücksetzen" : "Alle gesehen";
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
    backBottom.textContent = "‹ Zurück zur Übersicht";
    backBottom.addEventListener("click", () => {
      this._selectedSeriesId = null;
      this._detail = null;
      this._render();
    });
    wrap.appendChild(backBottom);

    return wrap;
  }

  _renderTmdbAttribution() {
    // Pflichthinweis laut TMDB API-Nutzungsbedingungen
    // (https://www.themoviedb.org/api-terms-of-use): Text + Logo, weniger
    // prominent als das eigene App-Logo im Header (siehe dort: 34px Icon
    // + 24px Titel vs. hier 14px Logo + 10.5px Text).
    const wrap = this._el("div", "tmdb-attribution");
    const logo = document.createElement("img");
    logo.src = `/${DOMAIN}/tmdb-logo.svg`;
    logo.alt = "TMDB";
    // Falls die Logo-Datei noch nicht hinterlegt wurde, blenden wir sie
    // einfach aus statt ein kaputtes Bild anzuzeigen.
    logo.addEventListener("error", () => {
      logo.style.display = "none";
    });
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
    description: "Serien-Watchlist mit themoviedb.org als Datenquelle – Episoden abhaken.",
    preview: false,
  });
}
})();

import { HibikiSearchEngine } from './search-engine.js';
import { normalizeQuery } from './search-normalizer.js';
import { createLibraryProvider } from './providers/library.js';
import { createYouTubeProvider } from './providers/youtube.js';
import { createSoundCloudProvider } from './providers/soundcloud.js';
import { createJamendoProvider } from './providers/jamendo.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13M9 18c0 2-1.6 3-3.5 3S2 20 2 18 3.6 15 5.5 15 9 16 9 18zm12-2c0 2-1.6 3-3.5 3S14 18 14 16s1.6-3 3.5-3 3.5 1 3.5 3z"/></svg>';
const sourceNames = { library: 'HIBIKI', youtube: 'YouTube', soundcloud: 'SoundCloud', jamendo: 'Jamendo' };
const readLocal = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
const parseHistory = () => { try { const value = JSON.parse(localStorage.getItem('hibiki.search.history') || '[]'); return Array.isArray(value) ? value.filter(x => typeof x === 'string').slice(0, 12) : []; } catch { return []; } };

export function setupSearchUI({ getLibrary, onPlay, onOpenPlaylist, onOpenExternal, onPageChange }) {
  const state = { query: '', byProvider: {}, statuses: {}, sort: 'relevance', timer: 0, history: parseHistory(), filters: {}, sequence: 0 };
  const providers = [
    createLibraryProvider(getLibrary),
    createYouTubeProvider(() => readLocal('hibiki.youtubeApiKey')),
    createSoundCloudProvider(),
    createJamendoProvider(() => readLocal('hibikiJamClient'))
  ];
  const engine = new HibikiSearchEngine({ providers, onUpdate: handleUpdate });

  function enabled() { return [...document.querySelectorAll('[data-search-source]:checked')].map(input => input.value); }
  function remember(query) {
    const cleaned = query.trim(); if (!cleaned) return;
    state.history = [cleaned, ...state.history.filter(item => item.toLocaleLowerCase() !== cleaned.toLocaleLowerCase())].slice(0, 12);
    try { localStorage.setItem('hibiki.search.history', JSON.stringify(state.history)); } catch { /* Search stays usable if local history storage is unavailable. */ }
  }
  function renderHistory() {
    const root = $('#searchHistory'); if (!root) return;
    const library = getLibrary();
    const favoriteArtists = [...new Set(library.tracks.filter(track => library.favorites.has(track.id) && track.artist).map(track => track.artist))].slice(0, 5);
    const recent = state.history.length ? `<div class="search-history-head"><h3>Recherches récentes</h3><button class="text-button" data-clear-history>Effacer</button></div><div class="search-history-chips">${state.history.map(item => `<button class="search-chip" data-history="${esc(item)}">${esc(item)}</button>`).join('')}</div>` : '';
    const suggestions = favoriteArtists.length ? `<div class="search-history-head"><h3>Artistes de tes favoris</h3></div><div class="search-history-chips">${favoriteArtists.map(item => `<button class="search-chip" data-suggest="${esc(item)}">${esc(item)}</button>`).join('')}</div>` : '';
    root.innerHTML = recent + suggestions || '<p class="search-muted">Tes recherches récentes et artistes favoris apparaîtront ici.</p>';
    root.querySelectorAll('[data-history],[data-suggest]').forEach(button => button.addEventListener('click', () => run(button.dataset.history || button.dataset.suggest, true)));
    root.querySelector('[data-clear-history]')?.addEventListener('click', () => { state.history = []; try { localStorage.removeItem('hibiki.search.history'); } catch {} renderHistory(); });
  }
  function sourceStateText(id, stateName, error) {
    if (stateName === 'loading') return 'Recherche…';
    if (stateName === 'loading-more') return 'Chargement…';
    if (stateName === 'disabled') return 'Source désactivée';
    if (stateName === 'error') return error || 'Source indisponible';
    if (stateName === 'ready') return (state.byProvider[id] || []).length ? `${state.byProvider[id].length} résultat(s)` : 'Aucun résultat';
    return '';
  }
  function resultCard(item) {
    const image = item.thumbnail ? `<img loading="lazy" src="${esc(item.thumbnail)}" alt="" onerror="this.remove()">` : icon;
    const playableLabel = item.playable ? (item.playbackType === 'youtube-embed' ? 'Lire dans le lecteur YouTube' : item.playbackType === 'soundcloud-widget' ? 'Écouter via SoundCloud' : 'Lire') : item.contentType === 'playlist' ? 'Ouvrir la playlist' : 'Lecture indisponible';
    const duration = item.duration ? `${Math.floor(item.duration / 60)}:${String(Math.floor(item.duration % 60)).padStart(2, '0')}` : 'Durée non fournie';
    const genres = item.genre ? `<span class="search-meta">${esc(item.genre)}</span>` : '';
    const favorite = item.source === 'library' && item.raw?.favorite ? '<span class="search-meta favorite-meta">Favori HIBIKI</span>' : '';
    const license = item.license ? `<span class="search-meta">Licence · ${esc(item.license)}</span>` : '';
    const sourcePills = item.sources.map(source => `<span class="source-pill source-${esc(source)}">${esc(sourceNames[source] || source)}</span>`).join('');
    const disabled = !item.playable && item.contentType !== 'playlist';
    return `<article class="search-result" data-result="${esc(item.id)}"><div class="search-art">${image}</div><div class="search-result-copy"><div class="search-result-title"><h3>${esc(item.title)}</h3><span class="content-pill">${esc(item.contentType === 'video' ? 'Vidéo' : item.contentType === 'playlist' ? 'Playlist' : 'Morceau')}</span></div><p>${esc(item.artist)}</p><div class="search-result-meta"><span>${esc(duration)}</span><span class="availability ${esc(item.availability)}">${esc(item.availability === 'local' ? 'Disponible ici' : item.availability === 'playable' || item.availability === 'embedded' ? 'Lecture disponible' : item.availability === 'metadata-only' ? 'Métadonnées synchronisées · audio local ailleurs' : 'Ouvrir la source')}</span>${genres}${favorite}${license}</div><div class="search-sources">${sourcePills}</div></div><button class="search-play" type="button" ${disabled ? 'disabled' : ''} aria-label="${esc(playableLabel)}">${item.playable ? '▶' : item.contentType === 'playlist' ? '↗' : '—'}</button></article>`;
  }
  function eventualAppend(id) { return Boolean(state.appendErrors?.[id]); }
  function renderResults() {
    const root = $('#searchResults'); if (!root) return;
    const sourceIds = ['library', 'youtube', 'soundcloud', 'jamendo'];
    const hasQuery = !!state.query.trim();
    const groups = sourceIds.map(id => {
      const checked = enabled().includes(id), statusName = state.statuses[id] || (checked ? 'waiting' : 'disabled');
      const results = (state.byProvider[id] || []).filter(item => {
        const field = state.filters.field || 'all', q = normalizeQuery(state.query), genre = normalizeQuery(state.filters.genre || '');
        const titleMatch = !q || normalizeQuery(item.title).includes(q), artistMatch = !q || normalizeQuery(item.artist).includes(q);
        const textMatch = !q || field === 'title' ? titleMatch : field === 'artist' ? artistMatch : true;
        return textMatch && (!genre || normalizeQuery(item.genre || '').includes(genre));
      });
      const more = state.next?.[id] != null && statusName === 'ready' ? `<button class="search-more" data-more="${id}">Charger plus</button>` : state.next?.[id] != null && statusName === 'error' ? `<button class="search-more" data-more="${id}">Réessayer</button>` : statusName === 'error' ? `<button class="search-more" data-retry="${id}">Réessayer</button>` : '';
      const error = state.errors?.[id];
      const errorNotice = statusName === 'error' && results.length ? `<p class="search-source-state error">${esc(error || 'Source indisponible.')} · ${eventualAppend(id) ? 'Le chargement supplémentaire a échoué.' : 'Résultats partiels conservés.'}</p>` : '';
      const cards = results.map(resultCard).join('');
      const body = cards + errorNotice || (hasQuery && ['ready', 'error', 'disabled'].includes(statusName) ? `<p class="search-source-state ${statusName === 'error' ? 'error' : ''}">${esc(sourceStateText(id, results.length || statusName !== 'ready' ? statusName : 'ready', error))}</p>` : '');
      if (!hasQuery && id !== 'library') return '';
      return `<section class="search-source-group"><div class="search-source-heading"><div><span class="source-pill source-${id}">${sourceNames[id]}</span><span class="search-source-count">${hasQuery ? esc(sourceStateText(id, statusName, error)) : 'Dans ta bibliothèque'}</span></div>${more}</div>${body}</section>`;
    }).join('');
    if (!hasQuery) {
      root.innerHTML = `<div class="search-welcome"><div class="search-welcome-icon">${icon}</div><h2>Qu’est-ce que tu veux écouter ?</h2><p>Une recherche peut interroger ta bibliothèque et les catalogues que tu as activés.</p></div>${groups}`;
      return;
    }
    const anySelected = enabled().length > 0;
    const anyResults = Object.values(state.byProvider).some(list => list?.length);
    const active = Object.values(state.statuses).some(statusName => statusName === 'loading' || statusName === 'loading-more');
    const allFailed = Object.values(state.statuses).filter(x => x !== 'disabled').length > 0 && Object.values(state.statuses).filter(x => x !== 'disabled').every(x => x === 'error');
    root.innerHTML = `${!anySelected ? '<div class="search-banner">Active au moins une source pour lancer une recherche.</div>' : ''}${allFailed && !anyResults ? '<div class="search-banner error">Les sources sélectionnées sont indisponibles. Vérifie leur configuration et réessaie.</div>' : ''}${!anyResults && !active && !allFailed && anySelected ? '<div class="search-welcome"><p>Aucun résultat pour cette recherche dans les sources activées.</p></div>' : ''}${groups}`;
    root.querySelectorAll('[data-result]').forEach(card => {
      const item = Object.values(state.byProvider).flat().find(result => result.id === card.dataset.result);
      card.querySelector('.search-play')?.addEventListener('click', event => {
        event.stopPropagation(); if (!item) return;
        if (item.contentType === 'playlist') onOpenPlaylist(item);
        else if (item.playable) onPlay(item);
      });
      card.addEventListener('dblclick', () => item?.playable && onPlay(item));
      card.addEventListener('click', () => item?.url && onOpenExternal(item));
    });
    root.querySelectorAll('[data-more]').forEach(button => button.addEventListener('click', () => engine.loadMore(button.dataset.more)));
    root.querySelectorAll('[data-retry]').forEach(button => button.addEventListener('click', () => engine.retry(button.dataset.retry)));
  }
  function handleUpdate(event) {
    if (event.type === 'reset') {
      state.appendErrors = {};
      state.sequence = event.sequence;
      state.query = event.query; state.byProvider = {}; state.statuses = {}; state.next = {}; state.errors = {};
      for (const id of event.providers) { state.statuses[id] = 'waiting'; state.byProvider[id] = []; }
      renderResults(); return;
    }
    if (event.sequence !== state.sequence) return;
    if (event.type === 'provider') {
      state.statuses[event.provider] = event.state;
      if (event.state === 'loading' || event.state === 'loading-more') delete state.errors[event.provider];
      if (event.append !== undefined) state.appendErrors[event.provider] = event.append;
      if (event.results) state.byProvider[event.provider] = event.results;
      if (event.next !== undefined) state.next[event.provider] = event.next;
      if (event.error) state.errors[event.provider] = event.error;
      renderResults(); return;
    }
    if (event.type === 'results') {
      state.ranked = event.results;
      const rankedBySource = {};
      for (const item of event.results) (rankedBySource[item.source] ||= []).push(item);
      for (const [source, items] of Object.entries(rankedBySource)) state.byProvider[source] = items;
      renderResults();
    }
  }
  function run(query, saveHistory = false) {
    query = String(query || '').slice(0, 160);
    state.query = query;
    engine.cancel();
    state.byProvider = {}; state.statuses = {}; state.next = {}; state.errors = {};
    for (const id of ['library', 'youtube', 'soundcloud', 'jamendo']) state.statuses[id] = enabled().includes(id) ? 'waiting' : 'disabled';
    renderResults();
    $('#searchQuery').value = query; $('#globalSearch').value = query;
    state.filters = { field: $('#searchField').value, genre: $('#searchGenre').value.trim().slice(0, 64) };
    state.sort = $('#searchSort').value;
    if (onPageChange) onPageChange('search');
    if (saveHistory) remember(query);
    clearTimeout(state.timer);
    state.timer = setTimeout(() => engine.search(query, { enabled: enabled(), filters: state.filters, sort: state.sort }), 300);
    renderHistory();
  }

  for (const input of [$('#globalSearch'), $('#searchQuery')]) {
    input.addEventListener('focus', () => onPageChange?.('search'));
    input.addEventListener('input', () => run(input.value));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); clearTimeout(state.timer); remember(input.value); run(input.value, true); } });
  }
  document.querySelectorAll('[data-search-source]').forEach(input => input.addEventListener('change', () => run($('#searchQuery').value)));
  $('#searchField').addEventListener('change', () => run($('#searchQuery').value));
  $('#searchGenre').addEventListener('input', () => run($('#searchQuery').value));
  $('#searchSort').addEventListener('change', () => run($('#searchQuery').value));
  $('#searchHistory').addEventListener('click', event => { if (event.target.id === 'searchClearAll') { state.history = []; try { localStorage.removeItem('hibiki.search.history'); } catch {} renderHistory(); } });
  renderHistory(); renderResults();
  return { search: run, engine };
}

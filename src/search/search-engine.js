import { SearchCache } from './search-cache.js';
import { mergeDuplicates, rankResults } from './search-ranking.js';
import { normalizeQuery } from './search-normalizer.js';

export class HibikiSearchEngine {
  constructor({ providers = [], onUpdate = () => {}, cache = new SearchCache() } = {}) {
    this.providers = new Map(providers.map(provider => [provider.id, provider]));
    this.onUpdate = onUpdate;
    this.cache = cache;
    this.sequence = 0;
    this.request = null;
  }

  register(provider) { this.providers.set(provider.id, provider); }

  search(query, { enabled = [], filters = {}, sort = 'relevance' } = {}) {
    this.cancel();
    const sequence = ++this.sequence;
    const controller = new AbortController();
    const selected = new Set(enabled);
    this.request = { sequence, query: query.trim(), filters, sort, controller, pages: new Map(), results: new Map(), pending: new Set() };
    if (!query.trim()) {
      this.onUpdate({ type: 'reset', sequence, query: '', providers: [...this.providers.keys()] });
      return;
    }
    this.onUpdate({ type: 'reset', sequence, query, providers: [...this.providers.keys()] });
    for (const provider of this.providers.values()) {
      if (!selected.has(provider.id)) {
        this.onUpdate({ type: 'provider', sequence, provider: provider.id, state: 'disabled', results: [] });
        continue;
      }
      this.#load(provider, 0, false, sequence);
    }
  }

  async #load(provider, page, append, sequence) {
    const active = this.request;
    if (!active || active.sequence !== sequence || active.controller.signal.aborted || active.pending.has(provider.id)) return;
    active.pending.add(provider.id);
    const cacheKey = provider.cacheKey ? provider.cacheKey({ query: active.query, page, filters: active.filters, sort: active.sort }) : JSON.stringify([provider.id, active.query.toLocaleLowerCase(), page, active.filters, active.sort]);
    this.onUpdate({ type: 'provider', sequence, provider: provider.id, state: append ? 'loading-more' : 'loading' });
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.#receive(provider, cached, append, sequence, true);
      active.pending.delete(provider.id);
      return;
    }
    const providerController = new AbortController();
    const forwardAbort = () => providerController.abort(active.controller.signal.reason);
    active.controller.signal.addEventListener('abort', forwardAbort, { once: true });
    const timeout = setTimeout(() => providerController.abort(new DOMException('La source a dépassé le délai de réponse.', 'TimeoutError')), 12_000);
    try {
      const result = await provider.search({ query: active.query, page, filters: active.filters, sort: active.sort, signal: providerController.signal });
      if (!this.request || this.request.sequence !== sequence || active.controller.signal.aborted) return;
      this.cache.set(cacheKey, result);
      this.#receive(provider, result, append, sequence, false);
    } catch (error) {
      const reason = providerController.signal.reason;
      if ((error?.name === 'AbortError' && reason?.name !== 'TimeoutError') || !this.request || this.request.sequence !== sequence) return;
      this.onUpdate({ type: 'provider', sequence, provider: provider.id, state: 'error', error: reason?.name === 'TimeoutError' ? reason.message : (error.message || 'Source indisponible.'), append });
    } finally {
      clearTimeout(timeout);
      active.controller.signal.removeEventListener('abort', forwardAbort);
      active.pending.delete(provider.id);
    }
  }

  #receive(provider, result, append, sequence, cached) {
    const active = this.request;
    if (!active || active.sequence !== sequence) return;
    const previous = append ? (active.results.get(provider.id) || []) : [];
    const q = normalizeQuery(active.query), field = active.filters.field || 'all', genre = normalizeQuery(active.filters.genre || '');
    const filtered = (result.results || []).filter(item => {
      const title = normalizeQuery(item.title), artist = normalizeQuery(item.artist);
      let textMatch = true;
      if (q && field === 'title') textMatch = title.includes(q);
      else if (q && field === 'artist') textMatch = artist.includes(q);
      return textMatch && (!genre || normalizeQuery(item.genre || '').includes(genre));
    });
    const results = [...previous, ...filtered];
    active.results.set(provider.id, results);
    active.pages.set(provider.id, result.next ?? null);
    this.onUpdate({ type: 'provider', sequence, provider: provider.id, state: 'ready', results, next: result.next ?? null, total: result.total ?? null, cached });
    const merged = mergeDuplicates([...active.results.values()].flat());
    this.onUpdate({ type: 'results', sequence, results: rankResults(merged, active.query, active.sort), sort: active.sort });
  }

  retry(providerId) {
    const active = this.request, provider = this.providers.get(providerId);
    if (!active || !provider || active.controller.signal.aborted) return;
    active.results.delete(providerId); active.pages.delete(providerId);
    this.#load(provider, 0, false, active.sequence);
  }

  loadMore(providerId) {
    const active = this.request, provider = this.providers.get(providerId);
    if (!active || !provider || active.controller.signal.aborted) return;
    const page = active.pages.get(providerId);
    if (page == null) return;
    this.#load(provider, page, true, active.sequence);
  }

  cancel() {
    if (this.request) this.request.controller.abort();
    this.request = null;
  }
}

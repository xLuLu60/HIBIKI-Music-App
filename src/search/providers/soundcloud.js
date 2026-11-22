import { normalizeResult } from '../search-normalizer.js';

let cachedAccessToken = '';
let tokenExpiresAt = 0;

export function createSoundCloudProvider({ tokenEndpoint = '/.netlify/functions/soundcloud-token' } = {}) {
  return {
    id: 'soundcloud', label: 'SoundCloud', enabledByDefault: true,
    cacheKey: ({ query, page, filters }) => JSON.stringify(['soundcloud', query.toLocaleLowerCase(), page, filters.genre || '']),
    async search({ query, page, filters = {}, signal }) {
      let tokenData = { access_token: cachedAccessToken };
      if (!cachedAccessToken || tokenExpiresAt < Date.now() + 60_000) {
        const tokenResponse = await fetch(tokenEndpoint, { signal });
        const responseData = await tokenResponse.json().catch(() => ({}));
        if (!tokenResponse.ok) throw Error(responseData.error || 'Configure les identifiants serveur SoundCloud sur Netlify.');
        tokenData = responseData; cachedAccessToken = responseData.access_token; tokenExpiresAt = Date.now() + Number(responseData.expires_in || 3600) * 1000;
      }
      const params = new URLSearchParams({ q: filters.genre ? `${query} ${filters.genre}` : query, limit: '20', linked_partitioning: 'true', access: 'playable' });
      if (filters.genre) params.set('genres', filters.genre);
      if (page && typeof page === 'string') { const nextUrl = new URL(page); if (nextUrl.origin !== 'https://api.soundcloud.com') throw Error('URL de pagination SoundCloud inattendue.'); }
      else if (page) params.set('offset', String(page));
      const requestUrl = typeof page === 'string' ? page : `https://api.soundcloud.com/tracks?${params}`;
      const requestOptions = token => ({ signal, headers: { Authorization: `OAuth ${token}`, Accept: 'application/json; charset=utf-8' } });
      const response = await fetch(requestUrl, requestOptions(tokenData.access_token));
      const data = await response.json();
      if (!response.ok) throw Error(data.errors?.[0]?.error_message || `SoundCloud HTTP ${response.status}`);
      const tracks = Array.isArray(data) ? data : data.collection || [];
      const nextHref = data.next_href || null;
      const nextPage = nextHref ? new URL(nextHref).toString() : null;
      return {
        results: tracks.map(track => normalizeResult({ id: track.id || track.urn, title: track.title, artist: track.user?.username, thumbnail: track.artwork_url || track.user?.avatar_url, duration: track.duration ? Math.round(track.duration / 1000) : null, genre: track.genre, contentType: 'track', availability: track.access === 'playable' ? 'embedded' : 'open', playable: track.access === 'playable' && !!track.permalink_url, playbackType: 'soundcloud-widget', popularity: Number(track.playback_count) || null, publishedAt: track.created_at, url: track.permalink_url, raw: { urn: track.urn, access: track.access } }, 'soundcloud')).filter(Boolean),
        next: nextPage, total: null
      };
    }
  };
}

import { normalizeResult } from '../search-normalizer.js';

export function createJamendoProvider(getClientId) {
  return {
    id: 'jamendo', label: 'Jamendo', enabledByDefault: true,
    cacheKey: ({ query, page, filters, sort }) => JSON.stringify(['jamendo', query.toLocaleLowerCase(), page, filters.genre || '', sort]),
    async search({ query, page = 0, filters = {}, signal, sort = 'relevance' }) {
      const clientId = getClientId();
      if (!clientId) throw Error('Ajoute ton Client ID Jamendo dans Paramètres.');
      const params = new URLSearchParams({ client_id: clientId, format: 'json', limit: '20', offset: String(page * 20), search: query, include: 'licenses musicinfo stats', order: sort === 'popular' ? 'popularity_total' : sort === 'recent' ? 'releasedate_desc' : 'relevance', audioformat: 'mp31' });
      if (filters.genre) params.set('tags', filters.genre);
      const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`, { signal });
      const data = await response.json();
      if (!response.ok || data.headers?.status === 'failed') throw Error(data.headers?.error_message || `Jamendo HTTP ${response.status}`);
      return {
        results: (data.results || []).map(track => {
          const stats = track.stats || {}, popularity = stats.popularity_total ?? stats.listens_total;
          return normalizeResult({ id: track.id, title: track.name, artist: track.artist_name, thumbnail: track.image, duration: Number(track.duration), genre: (track.musicinfo?.tags?.genres || []).join(', '), contentType: 'track', availability: track.audio ? 'playable' : 'open', playable: !!track.audio, playbackType: 'audio', popularity: popularity == null ? null : Number(popularity), publishedAt: track.releasedate, url: track.shareurl || track.shorturl || '', license: track.license_ccurl || track.license || '', raw: { id: track.id, name: track.name, artist_name: track.artist_name, audio: track.audio, album_image: track.album_image, image: track.image, duration: track.duration, license_ccurl: track.license_ccurl } }, 'jamendo');
        }).filter(Boolean),
        next: (data.results || []).length === 20 ? page + 1 : null,
        total: data.headers?.results_fullcount ?? null
      };
    }
  };
}

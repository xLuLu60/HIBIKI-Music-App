import { normalizeResult, normalizeQuery } from '../search-normalizer.js';

export function createLibraryProvider(getData) {
  return {
    id: 'library', label: 'HIBIKI', enabledByDefault: true,
    cacheKey: ({ query, page, filters }) => JSON.stringify(['library', query.toLocaleLowerCase(), page, filters]),
    async search({ query, page = 0, filters = {}, signal }) {
      if (signal.aborted) throw new DOMException('Recherche annulée', 'AbortError');
      const data = getData(), q = normalizeQuery(query), field = filters.field || 'all';
      const matches = (title, artist = '', genre = '') => {
        const t = normalizeQuery(title), a = normalizeQuery(artist), g = normalizeQuery(genre);
        const queryMatch = !q || (field === 'title' ? t.includes(q) : field === 'artist' ? a.includes(q) : `${t} ${a}`.includes(q));
        return queryMatch && (!filters.genre || g.includes(normalizeQuery(filters.genre)));
      };
      const entries = [];
      const favoriteIds = data.favorites;
      for (const track of data.tracks) {
        if (String(track.id).startsWith('jam-')) continue;
        const genre = Array.isArray(track.genres) ? track.genres.join(', ') : track.genre || '';
        if (!matches(track.title, track.artist, genre)) continue;
        entries.push(normalizeResult({ id: track.id, localId: track.id, title: track.title, artist: track.artist, duration: track.duration, thumbnail: track.cover, genre, contentType: 'track', availability: track.remoteOnly ? 'metadata-only' : track.url && !track.blob ? 'external' : 'local', playable: !track.remoteOnly && !!(track.blob || track.url), playbackType: 'local', popularity: track.plays || null, addedAt: track.added ? new Date(track.added).toISOString() : null, raw: { favorite: favoriteIds.has(track.id), remoteOnly: !!track.remoteOnly, playCount: Number(track.plays) || 0 } }, 'library'));
      }
      for (const playlist of data.playlists) if (matches(playlist.name, playlist.desc, '')) entries.push(normalizeResult({ id: playlist.id, localId: playlist.id, title: playlist.name, artist: 'Playlist HIBIKI', contentType: 'playlist', availability: 'local', playable: false, raw: { trackCount: (playlist.ids || []).length } }, 'library'));
      const size = 30, start = page * size;
      return { results: entries.slice(start, start + size), next: start + size < entries.length ? page + 1 : null, total: entries.length };
    }
  };
}

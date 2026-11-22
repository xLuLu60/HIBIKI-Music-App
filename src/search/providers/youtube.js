import { normalizeResult } from '../search-normalizer.js';

const durationSeconds = iso => {
  const match = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : null;
};
export function createYouTubeProvider(getApiKey) {
  return {
    id: 'youtube', label: 'YouTube', enabledByDefault: true,
    cacheKey: ({ query, page, sort }) => JSON.stringify(['youtube', query.toLocaleLowerCase(), page, sort]),
    async search({ query, page, signal, sort = 'relevance' }) {
      const key = getApiKey();
      if (!key) throw Error('Ajoute une clé YouTube Data API dans Paramètres.');
      const params = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '10', q: query, key, order: sort === 'recent' ? 'date' : sort === 'popular' ? 'viewCount' : 'relevance' });
      if (page) params.set('pageToken', page);
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error?.message || `YouTube HTTP ${response.status}`);
      const items = (data.items || []).filter(item => item.id?.videoId);
      const ids = items.map(item => item.id.videoId);
      let detailById = new Map();
      if (ids.length) {
        try {
          const detailParams = new URLSearchParams({ part: 'contentDetails,statistics', id: ids.join(','), key });
          const detailResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailParams}`, { signal });
          const detailData = await detailResponse.json();
          if (detailResponse.ok) detailById = new Map((detailData.items || []).map(item => [item.id, item]));
        } catch (error) {
          if (signal.aborted) throw error;
          // Search snippets remain useful when optional duration/view details are unavailable.
        }
      }
      return {
        results: items.map(item => {
          const videoId = item.id?.videoId, details = detailById.get(videoId), snippet = item.snippet || {};
          return normalizeResult({ id: videoId, title: snippet.title, artist: snippet.channelTitle, thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url, duration: durationSeconds(details?.contentDetails?.duration), contentType: 'video', availability: 'embedded', playable: true, playbackType: 'youtube-embed', popularity: Number(details?.statistics?.viewCount) || null, publishedAt: snippet.publishedAt, url: `https://www.youtube.com/watch?v=${videoId}`, raw: { channelId: snippet.channelId } }, 'youtube');
        }).filter(Boolean),
        next: data.nextPageToken || null, total: data.pageInfo?.totalResults || null
      };
    }
  };
}

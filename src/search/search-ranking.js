import { normalizeQuery } from './search-normalizer.js';
const sourceWeight = { library: 1.18, jamendo: 1.05, soundcloud: 1, youtube: .96 };
const sourcePriority = { library: 0, jamendo: 1, soundcloud: 2, youtube: 3 };

export function rankResults(results, query, mode = 'relevance') {
  const q = normalizeQuery(query);
  const ranked = results.map(item => {
    const title = normalizeQuery(item.title), artist = normalizeQuery(item.artist);
    const phrase = `${title} ${artist}`;
    let score = sourceWeight[item.source] || 1;
    if (title === q) score += 7;
    else if (title.startsWith(q)) score += 5;
    else if (title.includes(q)) score += 3;
    if (artist === q) score += 4;
    else if (artist.startsWith(q)) score += 2.5;
    else if (artist.includes(q)) score += 1.5;
    if (q && phrase.includes(q)) score += 1;
    if (item.raw?.favorite) score += 1.8;
    if (item.raw?.playCount > 0) score += Math.min(.7, Math.log1p(item.raw.playCount) * .15);
    if (item.genre && normalizeQuery(item.genre).includes(q)) score += .4;
    if (mode === 'recent' && (item.publishedAt || item.addedAt)) { const date = Date.parse(item.publishedAt || item.addedAt); if (Number.isFinite(date)) score += Math.max(0, 1 - (Date.now() - date) / (365 * 86400000)); }
    return { ...item, score };
  });
  if (mode === 'popular') {
    // Compare each catalogue by its within-source order; raw plays/views are not comparable between services.
    const groups = new Map();
    for (const item of ranked) if (item.popularity != null) (groups.get(item.source) || groups.set(item.source, []).get(item.source)).push(item);
    for (const items of groups.values()) {
      items.sort((a, b) => b.popularity - a.popularity);
      items.forEach((item, index) => { item.popularityRank = items.length === 1 ? 1 : 1 - index / (items.length - 1); });
    }
    return ranked.sort((a, b) => {
      if (a.popularityRank != null || b.popularityRank != null) {
        const left = a.popularityRank ?? -1, right = b.popularityRank ?? -1;
        if (left !== right) return right - left;
      }
      return b.score - a.score;
    });
  }
  return ranked.sort((a, b) => {
    if (mode === 'recent') {
      const dateA = Date.parse(a.publishedAt || a.addedAt || '') || 0;
      const dateB = Date.parse(b.publishedAt || b.addedAt || '') || 0;
      if (dateA !== dateB) return dateB - dateA;
    }
    return b.score - a.score;
  });
}

export function mergeDuplicates(results) {
  const output = [];
  const byText = new Map();
  for (const item of results) {
    const key = `${normalizeQuery(item.title)}|${normalizeQuery(item.artist)}`;
    if (!key || key === '|') continue;
    const candidates = byText.get(key) || [];
    const found = candidates.find(candidate => !candidate.sources.includes(item.source) && !(candidate.duration && item.duration && Math.abs(candidate.duration - item.duration) > 5));
    if (!found) {
      const copy = { ...item, sources: [...(item.sources || [item.source])], alternates: [] };
      candidates.push(copy); byText.set(key, candidates); output.push(copy); continue;
    }
    const mergedSources = [...new Set([...found.sources, ...(item.sources || [item.source])])];
    const alternate = value => ({ source: value.source, url: value.url, playbackType: value.playbackType, playable: value.playable });
    const preferIncoming = (sourcePriority[item.source] ?? 99) < (sourcePriority[found.source] ?? 99);
    if (preferIncoming) {
      found.alternates.push(alternate(found));
      const alternates = found.alternates;
      Object.assign(found, item);
      found.alternates = alternates;
    } else {
      found.alternates.push(alternate(item));
      if (!found.thumbnail && item.thumbnail) found.thumbnail = item.thumbnail;
      if (!found.duration && item.duration) found.duration = item.duration;
      if (found.popularity == null && item.popularity != null) found.popularity = item.popularity;
    }
    found.sources = mergedSources;
  }
  return output;
}

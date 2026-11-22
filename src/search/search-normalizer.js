const safeExternalUrl = value => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
const safeImageUrl = value => { const raw = String(value || ''); if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(raw)) return raw; return safeExternalUrl(raw); };
const text = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function normalizeResult(raw, source) {
  const title = String(raw.title || '').trim();
  if (!title) return null;
  const id = String(raw.id ?? `${text(title)}-${text(raw.artist)}`);
  return {
    id: `${source}:${id}`,
    source,
    sources: [source],
    sourceId: id,
    title,
    artist: String(raw.artist || raw.channel || 'Artiste inconnu').trim(),
    thumbnail: safeImageUrl(raw.thumbnail),
    duration: Number.isFinite(Number(raw.duration)) && Number(raw.duration) > 0 ? Number(raw.duration) : null,
    genre: String(raw.genre || '').trim(),
    contentType: raw.contentType || 'track',
    availability: raw.availability || (raw.playable ? 'playable' : 'open'),
    playable: raw.playable === true,
    playbackType: raw.playbackType || null,
    popularity: raw.popularity == null || raw.popularity === '' ? null : (Number.isFinite(Number(raw.popularity)) ? Number(raw.popularity) : null),
    publishedAt: raw.publishedAt || null,
    addedAt: raw.addedAt || null,
    url: safeExternalUrl(raw.url),
    license: raw.license || '',
    localId: raw.localId || null,
    raw: raw.raw ?? null
  };
}

export function normalizeQuery(value) { return text(value); }

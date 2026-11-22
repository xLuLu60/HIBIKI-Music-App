let cachedToken = '';
let cachedRefreshToken = '';
let expiresAt = 0;
let tokenRequest = null;

async function exchangeToken(clientId, clientSecret, grant) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
  let body;
  if (grant.refresh_token) {
    body = new URLSearchParams({
      grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret,
      refresh_token: grant.refresh_token
    });
  } else {
    headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
    body = new URLSearchParams({ grant_type: 'client_credentials' });
  }
  const response = await fetch('https://secure.soundcloud.com/oauth/token', { method: 'POST', headers, body });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw Error(data.error_description || data.error || 'Impossible d’obtenir le jeton SoundCloud.');
  return data;
}

async function getToken() {
  if (cachedToken && expiresAt > Date.now() + 60_000) return cachedToken;
  if (tokenRequest) return tokenRequest;
  tokenRequest = (async () => {
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw Error('SoundCloud API non configurée sur Netlify.');
    let data;
    if (cachedRefreshToken) {
      try { data = await exchangeToken(clientId, clientSecret, { refresh_token: cachedRefreshToken }); }
      catch { data = null; }
    }
    if (!data) data = await exchangeToken(clientId, clientSecret, {});
    cachedToken = data.access_token;
    cachedRefreshToken = data.refresh_token || cachedRefreshToken;
    expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
    return cachedToken;
  })();
  try { return await tokenRequest; }
  finally { tokenRequest = null; }
}

export default async request => {
  if (request.method !== 'GET') return Response.json({ error: 'Méthode non autorisée.' }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
  try {
    const accessToken = await getToken();
    return Response.json({ access_token: accessToken, expires_in: Math.floor((expiresAt - Date.now()) / 1000) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = /non configurée/.test(error.message) ? 503 : 502;
    return Response.json({ error: error.message || 'Le service de jeton SoundCloud est indisponible.' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
};

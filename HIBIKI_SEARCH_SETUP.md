# Configuration HIBIKI Search Engine

HIBIKI Search Engine works immediately against the local library. Remote sources are enabled independently and show their own configuration/network errors. A failing provider does not stop the other providers. API keys and secrets are never committed by this setup.

## YouTube

1. Create/select a Google Cloud project, enable **YouTube Data API v3**, and create an API key.
2. Restrict the key to YouTube Data API v3 and HTTP referrers for your real HIBIKI domain(s). Do not use an unrestricted production key.
3. Open HIBIKI Settings → HIBIKI Search Engine and save the key on this device.

The client searches videos only and requests embeddable video results. It retrieves duration and view counts separately when available. Google documents `search.list` as limited to 100 calls/day for the default quota, so HIBIKI debounces searches, cancels stale requests, and caches results in memory. Clearing/reloading the page also clears this memory cache. See Google's [search.list reference](https://developers.google.com/youtube/v3/docs/search/list) and [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference).

Playing a YouTube result opens the YouTube embedded player. It remains a platform-controlled player; HIBIKI's audio mini-player, queue, and listen counter do not control or count that video. Embed restrictions can still vary by video, territory, and account despite the API's embeddable filter.

## Jamendo

Use the existing Jamendo Client ID field in HIBIKI Settings. The connector searches the official `/v3.0/tracks` endpoint, uses the returned track metadata/license/audio URL, and reports unavailable audio as non-playable. Respect the license information shown by Jamendo; the engine does not download those tracks. See Jamendo's [tracks API documentation](https://developer.jamendo.com/v3.0/tracks).

## SoundCloud (Netlify deployment)

SoundCloud now requires a registered app and secret-backed OAuth token for public API requests. HIBIKI never puts that secret in browser JavaScript. SoundCloud currently requires an Artist Pro account to register app credentials.

1. Register an app using SoundCloud's developer workflow and read its API terms.
2. In Netlify site settings, add environment variables `SOUNDCLOUD_CLIENT_ID` and `SOUNDCLOUD_CLIENT_SECRET` (mark the secret as sensitive).
3. Deploy this repository with its `netlify.toml`; the function at `/.netlify/functions/soundcloud-token` exchanges credentials server-side and caches the short-lived public-resource token per warm function instance.
4. Run locally with Netlify Dev (`netlify dev`) if you want to test the function locally. A plain static server will correctly show SoundCloud as unconfigured.

The connector asks the official API for playable public tracks only. Results open inside SoundCloud's official widget; HIBIKI does not extract or proxy audio. SoundCloud documents separate client-credentials token limits (50 per 12 hours per app and 30 per hour per IP); the function reuses access and single-use refresh tokens in warm/server sessions, and the browser reuses the returned access token. Serverless cold starts still require new client-credentials exchanges and can approach limits under heavy traffic; a 401 is surfaced to the user rather than hidden by repeated token requests. Watch for provider rate-limit messages and avoid aggressive retries. Pagination follows SoundCloud's `next_href`. See the official [SoundCloud API guide](https://developers.soundcloud.com/docs/api/guide), [app registration requirements](https://developers.soundcloud.com/docs/api/register-app), and [Widget API](https://developers.soundcloud.com/docs/api/html5-widget.html).

## Search behavior

- The central engine launches enabled providers concurrently and renders each provider as it responds.
- Search uses a 300 ms debounce, aborts old work immediately, and isolates provider timeouts at 12 seconds.
- Cache entries live in memory for five minutes, up to 80 keys. The exact query and provider page are cached independently.
- Search history is stored locally in this browser; suggestions come only from actual recent searches and favorite artists.
- Popularity uses provider-returned counts, compared by rank inside each source rather than comparing incomparable view/play counts across services. A source without a count falls back to HIBIKI's text relevance.
- Recent ordering uses each provider's publication/release date, or the local import date for HIBIKI tracks.
- Duplicate matching uses normalized title/artist and compatible durations; near-matches remain separate.
- YouTube and SoundCloud embeds are controlled by their platforms, outside HIBIKI's audio queue and playback controls.

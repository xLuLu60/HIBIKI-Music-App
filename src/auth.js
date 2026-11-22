const $ = (selector) => document.querySelector(selector);
let supabase = null;
let signupMode = false;
const status = (message, error = false) => {
  const modal = $('#authModalFeedback');
  const settings = $('#authFeedback');
  for (const node of [modal, settings]) {
    if (node) {
      node.textContent = message;
      node.classList.toggle('error', error);
    }
  }
};

async function createClient() {
  let config;
  try { config = (await import('../supabase-config.js')).default; }
  catch { return null; }
  if (!config?.url || !config?.anonKey) return null;
  if (!window.supabase?.createClient) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = () => reject(Error('Le SDK Supabase ne peut pas être chargé.'));
      document.head.append(script);
    });
  }
  return window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

function openAuth() {
  $('#authModal').classList.add('open');
  $('#authModal').setAttribute('aria-hidden', 'false');
  $('#authEmail').focus();
}
function closeAuth() {
  $('#authModal').classList.remove('open');
  $('#authModal').setAttribute('aria-hidden', 'true');
}
function setSignupMode(enabled) {
  signupMode = enabled;
  $('#authTitle').textContent = enabled ? 'Créer un compte' : 'Connexion';
  $('#authSubmit').textContent = enabled ? 'Créer mon compte' : 'Se connecter';
  $('#authToggle').textContent = enabled ? 'J’ai déjà un compte' : 'Créer un compte';
  $('#authPassword').autocomplete = enabled ? 'new-password' : 'current-password';
}

async function syncLocal(getData) {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const local = getData();
  const profile = { user_id: user.id, display_name: local.profile.name || '', bio: local.profile.bio || '',  };
  const result = await supabase.from('profiles').upsert(profile, { onConflict: 'user_id' });
  if (result.error) throw result.error;
  const metadata = {
    user_id: user.id,
    favorites: [...local.favorites],
    playlists: local.playlists.map(({ id, name, desc, ids }) => ({ id, name, description: desc || '', track_ids: ids || [] }))
  };
  const saved = await supabase.from('library_metadata').upsert(metadata, { onConflict: 'user_id' });
  if (saved.error) throw saved.error;
  // Only descriptive metadata is synchronized; imported audio blobs remain local.
  const tracks = local.tracks.filter(track => !track.id.startsWith('jam-')).map(track => ({
    user_id: user.id, local_id: track.id, title: track.title || '', artist: track.artist || '', duration: track.duration || 0,
    mime_type: track.mime || track.blob?.type || '', added_at: new Date(track.added || Date.now()).toISOString(),
    last_played_at: track.lastPlayed ? new Date(track.lastPlayed).toISOString() : null, play_count: track.plays || 0
  }));
  if (tracks.length) {
    const { error: trackError } = await supabase.from('library_tracks').upsert(tracks, { onConflict: 'user_id,local_id' });
    if (trackError) throw trackError;
  }
  status(`Synchronisation effectuée · ${tracks.length} métadonnées de morceaux · fichiers audio conservés localement.`);
}

export async function setupAuth(getData, onProfile, onMetadata) {
  $('#authOpenBtn').addEventListener('click', openAuth);
  $('#closeAuth').addEventListener('click', closeAuth);
  $('#authModal').addEventListener('click', event => { if (event.target.id === 'authModal') closeAuth(); });
  $('#authToggle').addEventListener('click', () => setSignupMode(!signupMode));
  $('#authForgot').addEventListener('click', async () => {
    if (!supabase) return status('Configure Supabase avant de demander une récupération de mot de passe.', true);
    const email = $('#authEmail').value.trim();
    if (!email) return status('Saisis ton adresse e-mail.', true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    status(error ? error.message : 'Si cette adresse correspond à un compte, un lien de récupération va être envoyé.');
  });
  $('#authForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) return status('Connexion indisponible : configure le projet Supabase localement puis recharge HIBIKI.', true);
    const email = $('#authEmail').value.trim(), password = $('#authPassword').value;
    const { data, error } = signupMode
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) return status(error.message, true);
    if (signupMode && !data.session) return status('Compte créé. Vérifie ta boîte e-mail pour confirmer ton adresse avant de te connecter.');
    status('Connexion confirmée. Chargement de la synchronisation…');
    closeAuth();
  });
  $('#authSignOutBtn').addEventListener('click', async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) status(error.message, true);
    else { $('#accountSummary').textContent = 'Mode local · compte déconnecté'; $('#authSignOutBtn').hidden = true; $('#authOpenBtn').hidden = false; status('Déconnexion effectuée. Tes données locales sont conservées.'); }
  });
  $('#passwordRecoveryForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: $('#newPassword').value });
    if (error) status(error.message, true);
    else { status('Mot de passe modifié.'); $('#passwordRecoveryForm').hidden = true; $('#authForm').hidden = false; }
  });
  try { supabase = await createClient(); }
  catch (error) { status(error.message || 'Configuration Supabase invalide.', true); }
  if (!supabase) {
    $('#accountSummary').textContent = 'Mode local · Supabase non configuré';
    status('Le compte distant est optionnel. Ajoute la configuration Supabase documentée pour l’activer.');
    return { sync: async () => {} };
  }
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      $('#passwordRecoveryForm').hidden = false;
      $('#authForm').hidden = true;
      openAuth();
    }
    const user = session?.user;
    $('#authOpenBtn').hidden = !!user;
    $('#authSignOutBtn').hidden = !user;
    if (!user) {
      $('#accountSummary').textContent = 'Mode local · compte déconnecté';
      return;
    }
    $('#accountSummary').textContent = `Connecté · ${user.email || 'compte HIBIKI'}`;
    // Make Supabase data calls after returning from its auth callback to avoid SDK lock contention.
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') setTimeout(async () => {
      try {
        const { data: remote, error } = await supabase.from('profiles').select('display_name,bio,avatar_data,banner_data').eq('user_id', user.id).maybeSingle();
        if (error) throw error;
        if (remote && (remote.display_name || remote.bio || remote.avatar_data || remote.banner_data)) {
          onProfile({ name: remote.display_name || '', bio: remote.bio || '', avatar: remote.avatar_data || '', banner: remote.banner_data || '' });
        }
        const { data: metadata, error: metadataError } = await supabase.from('library_metadata').select('favorites,playlists').eq('user_id', user.id).maybeSingle();
        if (metadataError) throw metadataError;
        if (metadata) {
          const { data: remoteTracks, error: tracksError } = await supabase.from('library_tracks').select('local_id,title,artist,duration,mime_type,added_at,last_played_at,play_count').eq('user_id', user.id);
          if (tracksError) throw tracksError;
          await onMetadata(metadata, remoteTracks || []);
        }
        await syncLocal(getData);
      } catch (error) {
        console.error('HIBIKI Supabase sync failed', error);
        status(`Synchronisation non effectuée : ${error.message || 'erreur réseau ou de configuration RLS'}. Les données locales restent disponibles.`, true);
      }
    }, 0);
  });
  return { sync: async () => { try { await syncLocal(getData); } catch (error) { status(`Synchronisation non effectuée : ${error.message}. Les changements restent enregistrés localement.`, true); } } };
}

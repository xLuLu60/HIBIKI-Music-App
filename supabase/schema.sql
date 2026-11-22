-- HIBIKI user-owned metadata. Audio blobs and imported files are never stored here.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 48),
  bio text not null default '' check (char_length(bio) <= 240),
  avatar_data text,
  banner_data text,
  updated_at timestamptz not null default now()
);
create table if not exists public.library_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  title text not null default '',
  artist text not null default '',
  duration real not null default 0 check (duration >= 0),
  mime_type text not null default '',
  added_at timestamptz not null default now(),
  last_played_at timestamptz,
  play_count integer not null default 0 check (play_count >= 0),
  primary key (user_id, local_id)
);
create table if not exists public.library_metadata (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorites jsonb not null default '[]'::jsonb check (jsonb_typeof(favorites) = 'array'),
  playlists jsonb not null default '[]'::jsonb check (jsonb_typeof(playlists) = 'array'),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.library_tracks enable row level security;
alter table public.library_metadata enable row level security;
-- Keep profile private by default; future public profiles need explicit product design/policies.
create policy "Own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own profile insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own library read" on public.library_tracks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own library insert" on public.library_tracks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own library update" on public.library_tracks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own metadata read" on public.library_metadata for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own metadata insert" on public.library_metadata for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own metadata update" on public.library_metadata for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.profiles, public.library_tracks, public.library_metadata to authenticated;

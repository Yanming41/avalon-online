-- 阿瓦隆账号系统：在 Supabase 后台 SQL Editor 里整段运行一次即可（重复运行也安全）
-- 包含：用户资料（唯一用户名）、头像存储桶、对局记录、战绩统计视图

-- ============ 用户资料 ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 唯一用户名（像 Instagram / Discord）：3–20 位小写字母、数字、下划线、点；不能以点开头/结尾，不能连续两个点
  username text not null unique
    check (username ~ '^[a-z0-9_.]{3,20}$' and username !~ '(^\.|\.$|\.\.)'),
  -- 昵称：游戏里显示的名字，可以重复，随时改
  display_name text not null check (char_length(display_name) between 1 and 12),
  -- 头像：上传的图片地址；为空时用 crest（纹章）
  avatar_url text,
  crest text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============ 对局记录（只有服务器用 service_role 写入） ============
create table if not exists public.games (
  id text primary key,
  ended_at timestamptz not null,
  winner text not null check (winner in ('good', 'evil')),
  reason text,
  player_count int not null,
  record jsonb not null
);

create table if not exists public.game_players (
  game_id text not null references public.games (id) on delete cascade,
  seat int not null,
  user_id uuid references public.profiles (id) on delete set null, -- 游客为空
  name text not null,
  role text not null,
  evil boolean not null,
  won boolean not null,
  primary key (game_id, seat)
);
create index if not exists game_players_user on public.game_players (user_id);

alter table public.games enable row level security;
alter table public.game_players enable row level security;
drop policy if exists "games are public" on public.games;
create policy "games are public" on public.games for select using (true);
drop policy if exists "game players are public" on public.game_players;
create policy "game players are public" on public.game_players for select using (true);

-- ============ 战绩统计视图 ============
create or replace view public.player_stats with (security_invoker = on) as
select
  p.id as user_id, p.username, p.display_name, p.avatar_url, p.crest,
  count(gp.*)::int as games,
  count(*) filter (where gp.won)::int as wins,
  count(*) filter (where not gp.evil)::int as good_games,
  count(*) filter (where not gp.evil and gp.won)::int as good_wins,
  count(*) filter (where gp.evil)::int as evil_games,
  count(*) filter (where gp.evil and gp.won)::int as evil_wins,
  max(g.ended_at) as last_played
from public.profiles p
join public.game_players gp on gp.user_id = p.id
join public.games g on g.id = gp.game_id
group by p.id;

create or replace view public.role_stats with (security_invoker = on) as
select gp.user_id, gp.role, count(*)::int as games, count(*) filter (where gp.won)::int as wins
from public.game_players gp
where gp.user_id is not null
group by gp.user_id, gp.role;

-- ============ Data API 权限（2026 年起新项目不会自动开放新表，必须显式 grant） ============
grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles, public.games, public.game_players, public.player_stats, public.role_stats to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles, public.games, public.game_players to service_role;
grant select on public.player_stats, public.role_stats to service_role;

-- ============ 头像存储桶（公开读，每人只能写自己的文件夹） ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar read" on storage.objects;
create policy "avatar read" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "avatar upload own" on storage.objects;
create policy "avatar upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatar update own" on storage.objects;
create policy "avatar update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatar delete own" on storage.objects;
create policy "avatar delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

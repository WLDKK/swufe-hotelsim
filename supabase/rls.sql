-- Baseline RLS helpers for a Supabase-hosted Postgres deployment.
-- Prisma running with a service role can bypass these policies, but keeping
-- them in source control makes the authorization model explicit and auditable.
-- These helper functions use SECURITY DEFINER because they read protected
-- tables while other policies are being evaluated.

create or replace function public.app_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '');
$$;

create or replace function public.app_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select role::text
      from public.users
      where id = public.app_user_id()
      limit 1
    ),
    'ANON'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_user_role() = 'ADMIN';
$$;

create or replace function public.is_teacher_for_semester(semester_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.semesters s
    where s.id = semester_id
      and s."creatorId" = public.app_user_id()
  );
$$;

create or replace function public.is_teacher_for_class(class_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.semesters s on s.id = c."semesterId"
    where c.id = class_id
      and s."creatorId" = public.app_user_id()
  );
$$;

create or replace function public.team_class_id(team_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t."classId"
  from public.teams t
  where t.id = team_id
  limit 1;
$$;

create or replace function public.is_teacher_for_team(team_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_teacher_for_class(public.team_class_id(team_id));
$$;

create or replace function public.is_member_of_team(team_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm."teamId" = team_id
      and tm."userId" = public.app_user_id()
  );
$$;

create or replace function public.is_member_of_class(class_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm."classId" = class_id
      and tm."userId" = public.app_user_id()
  );
$$;

create or replace function public.is_judge_for_competition(competition_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competition_judge_assignments assignment
    where assignment."competitionId" = competition_id
      and assignment."judgeId" = public.app_user_id()
  );
$$;

create or replace function public.is_teacher_for_competition(competition_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competitions competition
    where competition.id = competition_id
      and competition."createdById" = public.app_user_id()
  );
$$;

alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.sessions enable row level security;
alter table public.verification_tokens enable row level security;
alter table public.semesters enable row level security;
alter table public.classes enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.hotel_states enable row level security;
alter table public.rounds enable row level security;
alter table public.decisions enable row level security;
alter table public.round_results enable row level security;
alter table public.rulesets enable row level security;
alter table public.judge_scores enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_stages enable row level security;
alter table public.advancements enable row level security;
alter table public.announcements enable row level security;
alter table public.competition_judge_assignments enable row level security;
alter table public.system_configs enable row level security;
alter table public.audit_logs enable row level security;

-- The application reaches Postgres through server-side Prisma. Do not expose
-- private application tables to unauthenticated Supabase Data API callers;
-- authenticated access remains constrained by the policies below.
revoke all privileges on all tables in schema public from anon;
alter default privileges in schema public revoke all privileges on tables from anon;

-- PostgreSQL grants EXECUTE on functions to PUBLIC by default. Restrict the
-- policy helpers to authenticated requests and trusted server-side access.
revoke execute on function public.app_user_id() from public, anon;
revoke execute on function public.app_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_teacher_for_semester(text) from public, anon;
revoke execute on function public.is_teacher_for_class(text) from public, anon;
revoke execute on function public.team_class_id(text) from public, anon;
revoke execute on function public.is_teacher_for_team(text) from public, anon;
revoke execute on function public.is_member_of_team(text) from public, anon;
revoke execute on function public.is_member_of_class(text) from public, anon;
revoke execute on function public.is_judge_for_competition(text) from public, anon;
revoke execute on function public.is_teacher_for_competition(text) from public, anon;

-- Supabase projects may include this SECURITY DEFINER trigger helper. It must
-- never be callable as an unauthenticated Data API RPC.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon';
  end if;
end
$$;

grant execute on function public.app_user_id() to authenticated, service_role;
grant execute on function public.app_user_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_teacher_for_semester(text) to authenticated, service_role;
grant execute on function public.is_teacher_for_class(text) to authenticated, service_role;
grant execute on function public.team_class_id(text) to authenticated, service_role;
grant execute on function public.is_teacher_for_team(text) to authenticated, service_role;
grant execute on function public.is_member_of_team(text) to authenticated, service_role;
grant execute on function public.is_member_of_class(text) to authenticated, service_role;
grant execute on function public.is_judge_for_competition(text) to authenticated, service_role;
grant execute on function public.is_teacher_for_competition(text) to authenticated, service_role;

drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin
on public.users
for select
using (
  id = public.app_user_id()
  or public.is_admin()
);

drop policy if exists users_update_self_or_admin on public.users;
create policy users_update_self_or_admin
on public.users
for update
using (
  id = public.app_user_id()
  or public.is_admin()
)
with check (
  id = public.app_user_id()
  or public.is_admin()
);

-- Sensitive NextAuth tables should not be reachable from client-side Supabase
-- roles. Server-side Prisma with a service role can still access them.
drop policy if exists accounts_admin_only on public.accounts;
create policy accounts_admin_only
on public.accounts
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists sessions_admin_only on public.sessions;
create policy sessions_admin_only
on public.sessions
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists verification_tokens_admin_only on public.verification_tokens;
create policy verification_tokens_admin_only
on public.verification_tokens
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists semesters_teacher_or_admin on public.semesters;
create policy semesters_teacher_or_admin
on public.semesters
for all
using (
  "creatorId" = public.app_user_id()
  or public.is_admin()
)
with check (
  "creatorId" = public.app_user_id()
  or public.is_admin()
);

drop policy if exists classes_visible_to_members_teachers_admin on public.classes;
create policy classes_visible_to_members_teachers_admin
on public.classes
for select
using (
  public.is_teacher_for_class(id)
  or public.is_member_of_class(id)
  or public.is_admin()
);

drop policy if exists classes_insertable_by_teachers_admin on public.classes;
create policy classes_insertable_by_teachers_admin
on public.classes
for insert
with check (
  public.is_teacher_for_semester("semesterId")
  or public.is_admin()
);

drop policy if exists classes_updatable_by_teachers_admin on public.classes;
create policy classes_updatable_by_teachers_admin
on public.classes
for update
using (
  public.is_teacher_for_class(id)
  or public.is_admin()
)
with check (
  public.is_teacher_for_semester("semesterId")
  or public.is_admin()
);

drop policy if exists classes_deletable_by_teachers_admin on public.classes;
create policy classes_deletable_by_teachers_admin
on public.classes
for delete
using (
  public.is_teacher_for_class(id)
  or public.is_admin()
);

drop policy if exists teams_visible_to_members_teachers_admin on public.teams;
create policy teams_visible_to_members_teachers_admin
on public.teams
for select
using (
  public.is_member_of_team(id)
  or public.is_teacher_for_class("classId")
  or public.is_admin()
);

drop policy if exists teams_manageable_by_teachers_admin on public.teams;
create policy teams_manageable_by_teachers_admin
on public.teams
for all
using (
  public.is_teacher_for_class("classId")
  or public.is_admin()
)
with check (
  public.is_teacher_for_class("classId")
  or public.is_admin()
);

drop policy if exists team_members_visible_to_members_teachers_admin on public.team_members;
create policy team_members_visible_to_members_teachers_admin
on public.team_members
for select
using (
  public.is_member_of_team("teamId")
  or public.is_teacher_for_class("classId")
  or public.is_admin()
);

drop policy if exists team_members_manageable_by_teachers_admin on public.team_members;
create policy team_members_manageable_by_teachers_admin
on public.team_members
for all
using (
  public.is_teacher_for_class("classId")
  or public.is_admin()
)
with check (
  public.is_teacher_for_class("classId")
  or public.is_admin()
);

drop policy if exists hotel_states_visible_to_members_teachers_admin on public.hotel_states;
create policy hotel_states_visible_to_members_teachers_admin
on public.hotel_states
for select
using (
  public.is_member_of_team("teamId")
  or public.is_teacher_for_team("teamId")
  or public.is_admin()
);

drop policy if exists hotel_states_manageable_by_teachers_admin on public.hotel_states;
create policy hotel_states_manageable_by_teachers_admin
on public.hotel_states
for all
using (
  public.is_teacher_for_team("teamId")
  or public.is_admin()
)
with check (
  public.is_teacher_for_team("teamId")
  or public.is_admin()
);

drop policy if exists rounds_visible_to_class_members_teachers_admin on public.rounds;
create policy rounds_visible_to_class_members_teachers_admin
on public.rounds
for select
using (
  public.is_teacher_for_class("classId")
  or public.is_member_of_class("classId")
  or public.is_admin()
);

drop policy if exists rounds_manageable_by_teachers_admin on public.rounds;
create policy rounds_manageable_by_teachers_admin
on public.rounds
for all
using (
  public.is_teacher_for_class("classId")
  or public.is_admin()
)
with check (
  public.is_teacher_for_class("classId")
  or public.is_admin()
);

drop policy if exists decisions_visible_to_members_teachers_admin on public.decisions;
create policy decisions_visible_to_members_teachers_admin
on public.decisions
for select
using (
  public.is_member_of_team("teamId")
  or public.is_teacher_for_team("teamId")
  or public.is_admin()
);

drop policy if exists decisions_insertable_by_members_teachers_admin on public.decisions;
create policy decisions_insertable_by_members_teachers_admin
on public.decisions
for insert
with check (
  public.is_member_of_team("teamId")
  or public.is_teacher_for_team("teamId")
  or public.is_admin()
);

drop policy if exists decisions_updatable_by_members_teachers_admin on public.decisions;
create policy decisions_updatable_by_members_teachers_admin
on public.decisions
for update
using (
  public.is_member_of_team("teamId")
  or public.is_teacher_for_team("teamId")
  or public.is_admin()
)
with check (
  public.is_member_of_team("teamId")
  or public.is_teacher_for_team("teamId")
  or public.is_admin()
);

drop policy if exists decisions_deletable_by_teachers_admin on public.decisions;
create policy decisions_deletable_by_teachers_admin
on public.decisions
for delete
using (
  public.is_teacher_for_team("teamId")
  or public.is_admin()
);

drop policy if exists round_results_visible_to_members_teachers_admin on public.round_results;
create policy round_results_visible_to_members_teachers_admin
on public.round_results
for select
using (
  public.is_member_of_team("teamId")
  or public.is_teacher_for_team("teamId")
  or public.is_admin()
);

drop policy if exists round_results_manageable_by_teachers_admin on public.round_results;
create policy round_results_manageable_by_teachers_admin
on public.round_results
for all
using (
  public.is_teacher_for_team("teamId")
  or public.is_admin()
)
with check (
  public.is_teacher_for_team("teamId")
  or public.is_admin()
);

drop policy if exists system_configs_admin_only on public.system_configs;
create policy system_configs_admin_only
on public.system_configs
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists audit_logs_admin_only on public.audit_logs;
create policy audit_logs_admin_only
on public.audit_logs
for all
using (public.is_admin())
with check (public.is_admin());

-- Competition operations are server-driven today, but explicit policies keep
-- future Data API access least-privileged instead of silently relying on the
-- absence of grants.
drop policy if exists rulesets_read_authenticated on public.rulesets;
create policy rulesets_read_authenticated
on public.rulesets for select
using (public.app_user_id() is not null);

drop policy if exists rulesets_admin_manage on public.rulesets;
create policy rulesets_admin_manage
on public.rulesets for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists competitions_visible_to_staff on public.competitions;
create policy competitions_visible_to_staff
on public.competitions for select
using (
  public.is_teacher_for_competition(id)
  or public.is_judge_for_competition(id)
  or public.is_admin()
);

drop policy if exists competitions_manageable_by_owner_admin on public.competitions;
create policy competitions_manageable_by_owner_admin
on public.competitions for all
using (public.is_teacher_for_competition(id) or public.is_admin())
with check ("createdById" = public.app_user_id() or public.is_admin());

drop policy if exists competition_stages_visible_to_staff on public.competition_stages;
create policy competition_stages_visible_to_staff
on public.competition_stages for select
using (
  public.is_teacher_for_competition("competitionId")
  or public.is_judge_for_competition("competitionId")
  or public.is_admin()
);

drop policy if exists competition_stages_manageable_by_owner_admin on public.competition_stages;
create policy competition_stages_manageable_by_owner_admin
on public.competition_stages for all
using (
  public.is_teacher_for_competition("competitionId")
  or public.is_admin()
)
with check (
  public.is_teacher_for_competition("competitionId")
  or public.is_admin()
);

drop policy if exists competition_judge_assignments_visible_to_judge_admin on public.competition_judge_assignments;
create policy competition_judge_assignments_visible_to_judge_admin
on public.competition_judge_assignments for select
using ("judgeId" = public.app_user_id() or public.is_admin());

drop policy if exists competition_judge_assignments_admin_manage on public.competition_judge_assignments;
create policy competition_judge_assignments_admin_manage
on public.competition_judge_assignments for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists judge_scores_visible_to_owner_admin on public.judge_scores;
create policy judge_scores_visible_to_owner_admin
on public.judge_scores for select
using ("judgeId" = public.app_user_id() or public.is_admin());

drop policy if exists judge_scores_manageable_by_owner_admin on public.judge_scores;
create policy judge_scores_manageable_by_owner_admin
on public.judge_scores for all
using ("judgeId" = public.app_user_id() or public.is_admin())
with check ("judgeId" = public.app_user_id() or public.is_admin());

drop policy if exists advancements_visible_to_staff on public.advancements;
create policy advancements_visible_to_staff
on public.advancements for select
using (
  public.is_teacher_for_competition("competitionId")
  or public.is_judge_for_competition("competitionId")
  or public.is_member_of_team("teamId")
  or public.is_admin()
);

drop policy if exists advancements_manageable_by_owner_admin on public.advancements;
create policy advancements_manageable_by_owner_admin
on public.advancements for all
using (
  public.is_teacher_for_competition("competitionId")
  or public.is_admin()
)
with check (
  public.is_teacher_for_competition("competitionId")
  or public.is_admin()
);

drop policy if exists announcements_read_published_or_staff on public.announcements;
create policy announcements_read_published_or_staff
on public.announcements for select
using (
  "isPublished"
  or public.is_teacher_for_competition("competitionId")
  or public.is_judge_for_competition("competitionId")
  or public.is_admin()
);

drop policy if exists announcements_manageable_by_owner_admin on public.announcements;
create policy announcements_manageable_by_owner_admin
on public.announcements for all
using (
  public.is_teacher_for_competition("competitionId")
  or public.is_admin()
)
with check (
  public.is_teacher_for_competition("competitionId")
  or public.is_admin()
);

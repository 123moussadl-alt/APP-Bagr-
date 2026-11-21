-- Attendance data is restricted to the Director's school and the HR role.
-- Apply after the base schools and profiles tables are available.

alter table public.profiles
  add column if not exists matricule text,
  add column if not exists nom text,
  add column if not exists prenom text,
  add column if not exists nom_complet text,
  add column if not exists sexe text,
  add column if not exists date_naissance date,
  add column if not exists niveau_etude text,
  add column if not exists date_prise_service_ceb date,
  add column if not exists fonction text,
  add column if not exists ecole_id uuid references public.schools(id),
  add column if not exists ecole_nom text,
  add column if not exists classe_id uuid references public.classes(id),
  add column if not exists classe_niveau text,
  add column if not exists classe_tenue text,
  add column if not exists emploi text,
  add column if not exists ecoles_encadrees jsonb not null default '[]'::jsonb,
  add column if not exists structure text default 'CEB de Bagré',
  add column if not exists signature_url text,
  add column if not exists whatsapp text,
  add column if not exists telephone text;

alter table public.classes
  add column if not exists titulaire_nom text,
  add column if not exists co_titulaires uuid[] not null default '{}';

update public.schools as legacy
set name = official.name, ceb = 'BAGRÉ'
from (values
  ('École A de Bagré', 'Bagré Périmètre "A"'),
  ('Bagré Centre A', 'Bagré Périmètre "A"'),
  ('École B de Bagré', 'Bagré Périmètre "B"'),
  ('Bagré Centre B', 'Bagré Périmètre "B"'),
  ('École C de Bagré', 'Bagré Peulh'),
  ('École de Dirlakou', 'Dirlakou'),
  ('École de Goudayéré', 'Goudayéré'),
  ('Boakla', 'Bouakla')
) as official(legacy_name, name)
where lower(trim(legacy.name)) = lower(trim(official.legacy_name))
  and not exists (
    select 1
    from public.schools existing
    where existing.id <> legacy.id
      and lower(trim(existing.name)) = lower(trim(official.name))
  );

update public.schools
set ceb = 'ARCHIVE'
where upper(trim(coalesce(ceb, ''))) = 'BAGRÉ'
  and lower(trim(name)) in ('dirlakou', 'sangabouli', 'zabo');

insert into public.schools (name, ceb)
select official.name, 'BAGRÉ'
from (values
  ('Bagré Périmètre "A"'),
  ('Bagré Périmètre "B"'),
  ('Bagré Périmètre "C"'),
  ('Bagré Périmètre "D"'),
  ('Bagré Peulh'),
  ('Bagré Village'),
  ('Bagré V2'),
  ('Bagré V4'),
  ('Bagré V5'),
  ('Bagré V11'),
  ('Bagré V12'),
  ('Bégassé'),
  ('Bouakla'),
  ('Douka'),
  ('Goudayéré'),
  ('Guingalé'),
  ('Hihoudé'),
  ('Ounvin'),
  ('Patta Publique'),
  ('Poussouwaka'),
  ('Kalakoudi'),
  ('Saint Bénoît Abbé'),
  ('Sabiloul Falah'),
  ('Sabiloul Houda'),
  ('Sabiloul Raçad')
) as official(name)
where not exists (
  select 1
  from public.schools school
  where lower(trim(school.name)) = lower(trim(official.name))
);

create table if not exists public.class_teachers (
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

create table if not exists public.presences_agents (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references public.schools(id) on delete cascade,
  ecole_nom text not null,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  date_jour date not null,
  mois text not null,
  present boolean not null default true,
  observation text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists presences_agents_agent_day_uidx
  on public.presences_agents (agent_id, date_jour);
create index if not exists presences_agents_school_day_idx
  on public.presences_agents (ecole_id, date_jour);

create table if not exists public.bilans_agents_mensuels (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references public.schools(id) on delete cascade,
  ecole_nom text not null,
  mois text not null,
  annee_scolaire text not null,
  jours_ouvrables integer not null default 0 check (jours_ouvrables >= 0),
  statut_depot text not null default 'Depose' check (statut_depot = 'Depose'),
  directeur_nom text not null,
  date_depot timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists bilans_agents_school_month_year_uidx
  on public.bilans_agents_mensuels (ecole_id, annee_scolaire, mois);
create index if not exists bilans_agents_month_year_idx
  on public.bilans_agents_mensuels (annee_scolaire, mois);

create or replace function public.current_agent_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text from public.profiles p where p.id = auth.uid() limit 1
$$;

create or replace function public.current_agent_app_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.school_id, p.ecole_id)
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

revoke all on function public.current_agent_app_role() from public, anon;
revoke all on function public.current_agent_app_school_id() from public, anon;
grant execute on function public.current_agent_app_role() to authenticated;
grant execute on function public.current_agent_app_school_id() to authenticated;

drop policy if exists schools_manage_chef_ceb on public.schools;
create policy schools_manage_chef_ceb on public.schools
  for all to authenticated
  using (public.current_agent_app_role() = 'chef_ceb')
  with check (public.current_agent_app_role() = 'chef_ceb');

alter table public.schools enable row level security;
drop policy if exists schools_read_registration on public.schools;
create policy schools_read_registration on public.schools
  for select to anon, authenticated
  using (true);

drop policy if exists profiles_read_ceb_signer on public.profiles;
create policy profiles_read_ceb_signer on public.profiles
  for select to authenticated
  using (
    role = 'chef_ceb'
    and public.current_agent_app_role() = 'directeur'
  );

alter table public.presences_agents enable row level security;
alter table public.bilans_agents_mensuels enable row level security;
alter table public.profiles enable row level security;
alter table public.class_teachers enable row level security;

grant usage on schema public to authenticated;
grant select on public.schools to anon, authenticated;
grant insert, update on public.schools to authenticated;
grant select, insert on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (
  matricule, nom, prenom, nom_complet, sexe, date_naissance, niveau_etude,
  emploi, fonction, date_prise_service_ceb, ecole_id, ecole_nom, classe_id,
  classe_niveau, classe_tenue, whatsapp, telephone, full_name, gender,
  school_id, class_id, whatsapp_phone, signature_url, ecoles_encadrees,
  structure, followed_schools
) on public.profiles to authenticated;
grant select, insert, update on public.class_teachers to authenticated;
revoke all on public.presences_agents from public, anon;
revoke all on public.bilans_agents_mensuels from public, anon;
grant select, insert, update on public.presences_agents to authenticated;
grant select, insert, update on public.bilans_agents_mensuels to authenticated;

drop policy if exists profiles_read_agent_attendance on public.profiles;
create policy profiles_read_agent_attendance on public.profiles
  for select to authenticated
  using (
    public.current_agent_app_role() = 'chef_personnel'
    or (
      public.current_agent_app_role() = 'directeur'
      and school_id = public.current_agent_app_school_id()
    )
  );

drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_read_class_teachers on public.profiles;
create policy profiles_read_class_teachers on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.classes c
      where c.id = coalesce(profiles.class_id, profiles.classe_id)
        and c.school_id = public.current_agent_app_school_id()
        and (
          c.titulaire_id = auth.uid()
          or auth.uid() = any(c.co_titulaires)
        )
    )
  );

drop policy if exists class_teachers_read_school on public.class_teachers;
create policy class_teachers_read_school on public.class_teachers
  for select to authenticated
  using (
    teacher_id = auth.uid()
    or exists (
      select 1
      from public.classes c
      where c.id = class_teachers.class_id
        and c.school_id = public.current_agent_app_school_id()
    )
  );

drop policy if exists class_teachers_insert_self on public.class_teachers;
create policy class_teachers_insert_self on public.class_teachers
  for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.classes c
      where c.id = class_teachers.class_id
        and c.school_id = public.current_agent_app_school_id()
    )
  );

drop policy if exists class_teachers_update_self on public.class_teachers;
create policy class_teachers_update_self on public.class_teachers
  for update to authenticated
  using (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.classes c
      where c.id = class_teachers.class_id
        and c.school_id = public.current_agent_app_school_id()
    )
  )
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.classes c
      where c.id = class_teachers.class_id
        and c.school_id = public.current_agent_app_school_id()
    )
  );

drop policy if exists presences_agents_read_scope on public.presences_agents;
create policy presences_agents_read_scope on public.presences_agents
  for select to authenticated
  using (
    public.current_agent_app_role() = 'chef_personnel'
    or (
      public.current_agent_app_role() = 'directeur'
      and ecole_id = public.current_agent_app_school_id()
    )
  );

drop policy if exists presences_agents_write_school on public.presences_agents;
create policy presences_agents_write_school on public.presences_agents
  for all to authenticated
  using (
    public.current_agent_app_role() = 'directeur'
    and ecole_id = public.current_agent_app_school_id()
  )
  with check (
    public.current_agent_app_role() = 'directeur'
    and ecole_id = public.current_agent_app_school_id()
    and exists (
      select 1 from public.profiles agent
      where agent.id = presences_agents.agent_id
        and agent.school_id = presences_agents.ecole_id
    )
  );

drop policy if exists bilans_agents_read_scope on public.bilans_agents_mensuels;
create policy bilans_agents_read_scope on public.bilans_agents_mensuels
  for select to authenticated
  using (
    public.current_agent_app_role() = 'chef_personnel'
    or (
      public.current_agent_app_role() = 'directeur'
      and ecole_id = public.current_agent_app_school_id()
    )
  );

drop policy if exists bilans_agents_write_school on public.bilans_agents_mensuels;
create policy bilans_agents_write_school on public.bilans_agents_mensuels
  for all to authenticated
  using (
    public.current_agent_app_role() = 'directeur'
    and ecole_id = public.current_agent_app_school_id()
  )
  with check (
    public.current_agent_app_role() = 'directeur'
    and ecole_id = public.current_agent_app_school_id()
  );
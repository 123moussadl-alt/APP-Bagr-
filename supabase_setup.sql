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
  add column if not exists whatsapp_phone text,
  add column if not exists telephone text;

alter table public.classes
  add column if not exists titulaire_nom text,
  add column if not exists co_titulaires uuid[] not null default '{}';

do $$
declare
  role_constraint record;
begin
  for role_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', role_constraint.conname);
  end loop;
end
$$;

alter table public.profiles
  add constraint profiles_role_check
  check (role::text in (
    'titulaire', 'directeur', 'encadreur', 'chef_ceb',
    'chef_personnel', 'chef-personnel', 'statisticien'
  ));

update public.profiles
set emploi = case
      when role::text in ('encadreur', 'chef_ceb') then 'IEPNF'
      when upper(trim(coalesce(emploi, ''))) in ('PE', 'PCE') then upper(trim(emploi))
      when upper(trim(coalesce(fonction, ''))) in ('PE', 'PCE') then upper(trim(fonction))
      else null
    end,
    fonction = case role::text
      when 'titulaire' then 'Agent'
      when 'directeur' then 'Directeur'
      when 'encadreur' then 'Encadreur'
      when 'chef_personnel' then 'Chef du Personnel'
      when 'chef-personnel' then 'Chef du Personnel'
      when 'statisticien' then 'Statisticien'
      when 'chef_ceb' then 'Chef de la CEB'
      else case
        when upper(trim(coalesce(fonction, ''))) in ('PE', 'PCE', 'IC', 'IAC', 'IEPNF') then null
        else fonction
      end
    end
where role::text in ('titulaire', 'directeur', 'encadreur', 'chef_personnel', 'chef-personnel', 'statisticien', 'chef_ceb')
   or upper(trim(coalesce(fonction, ''))) in ('PE', 'PCE', 'IC', 'IAC', 'IEPNF');

update public.schools as legacy
set name = official.name, ceb = 'BAGRÉ'
from (values
  ('École A de Bagré', 'Bagré Périmètre "A"'),
  ('Bagré Centre A', 'Bagré Périmètre "A"'),
  ('École B de Bagré', 'Bagré Périmètre "B"'),
  ('Bagré Centre B', 'Bagré Périmètre "B"'),
  ('École C de Bagré', 'Bagré Peulh'),
  ('École de Dirlakou', 'Sanga Boulé'),
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
set ceb = 'BAGRÉ'
where lower(trim(name)) = 'sanga boulé';

with legacy_school as (
  select id,
    row_number() over (
      order by case lower(trim(name))
        when 'école de dirlakou' then 1
        when 'école de dirlakoula' then 2
        when 'dirlakou' then 3
        when 'dirlakoula' then 4
        when 'sangabouli' then 5
        when 'sangaboulé' then 6
        else 7
      end, id
    ) as position
  from public.schools
  where lower(trim(name)) in (
    'école de dirlakou', 'école de dirlakoula',
    'dirlakou', 'dirlakoula', 'sangabouli', 'sangaboulé'
  )
)
update public.schools as legacy
set name = 'Sanga Boulé', ceb = 'BAGRÉ'
from legacy_school
where legacy.id = legacy_school.id
  and legacy_school.position = 1
  and not exists (
    select 1
    from public.schools existing
    where existing.id <> legacy.id
      and lower(trim(existing.name)) = 'sanga boulé'
  );

update public.schools
set ceb = 'ARCHIVE'
where upper(trim(coalesce(ceb, ''))) = 'BAGRÉ'
  and lower(trim(name)) in (
    'dirlakou', 'dirlakoula', 'école de dirlakou', 'école de dirlakoula',
    'sangabouli', 'sangaboulé', 'zabo'
  );

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
  ('Sanga Boulé'),
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

-- Provision the creator by setting app_metadata.role = 'super_admin' through
-- Supabase Auth administration; never use user_metadata or a client-side code.
create or replace function public.is_principal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'super_admin'
$$;

revoke all on function public.is_principal_admin() from public, anon;
grant execute on function public.is_principal_admin() to authenticated;

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

drop policy if exists "profiles_own" on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (
    auth.uid() = id
    and role::text = 'titulaire'
    and fonction = 'Agent'
    and upper(trim(coalesce(emploi, ''))) in ('PE', 'PCE')
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role::text = public.current_agent_app_role()
    and case role::text
      when 'titulaire' then fonction = 'Agent' and upper(trim(coalesce(emploi, ''))) in ('PE', 'PCE')
      when 'directeur' then fonction = 'Directeur' and upper(trim(coalesce(emploi, ''))) in ('PE', 'PCE')
      when 'encadreur' then fonction = 'Encadreur' and upper(trim(coalesce(emploi, ''))) = 'IEPNF'
      when 'chef_ceb' then fonction = 'Chef de la CEB' and upper(trim(coalesce(emploi, ''))) = 'IEPNF'
      when 'chef_personnel' then fonction = 'Chef du Personnel' and upper(trim(coalesce(emploi, ''))) in ('PE', 'PCE')
      when 'chef-personnel' then fonction = 'Chef du Personnel' and upper(trim(coalesce(emploi, ''))) in ('PE', 'PCE')
      when 'statisticien' then fonction = 'Statisticien' and upper(trim(coalesce(emploi, ''))) in ('PE', 'PCE')
      else false
    end
  );

drop policy if exists profiles_read_chef_ceb_directory on public.profiles;
create policy profiles_read_chef_ceb_directory on public.profiles
  for select to authenticated
  using (public.current_agent_app_role() = 'chef_ceb');

drop policy if exists profiles_read_admin on public.profiles;
create policy profiles_read_admin on public.profiles
  for select to authenticated
  using (public.is_principal_admin());

drop policy if exists profiles_update_chef_ceb_director_contact on public.profiles;
create policy profiles_update_chef_ceb_director_contact on public.profiles
  for update to authenticated
  using (
    public.current_agent_app_role() = 'chef_ceb'
    and role::text = 'directeur'
  )
  with check (
    public.current_agent_app_role() = 'chef_ceb'
    and role::text = 'directeur'
  );

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

create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (setting_key, setting_value)
values ('active_school_year', '2026-2027')
on conflict (setting_key) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read_authenticated on public.app_settings;
create policy app_settings_read_authenticated on public.app_settings
  for select to authenticated
  using (true);

grant select on public.app_settings to authenticated;
revoke insert, update, delete on public.app_settings from public, anon, authenticated;

create or replace function public.get_active_school_year()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select setting_value
  from public.app_settings
  where setting_key = 'active_school_year'
  limit 1
$$;

create or replace function public.admin_set_school_year(p_year text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  start_year integer;
  end_year integer;
begin
  if not public.is_principal_admin() then
    raise exception 'Administrateur Principal required' using errcode = '42501';
  end if;
  if p_year is null or p_year !~ '^[0-9]{4}-[0-9]{4}$' then
    raise exception 'Invalid school-year format; expected YYYY-YYYY' using errcode = '22023';
  end if;

  start_year := split_part(p_year, '-', 1)::integer;
  end_year := split_part(p_year, '-', 2)::integer;
  if end_year <> start_year + 1 then
    raise exception 'School year must contain consecutive years' using errcode = '22023';
  end if;

  insert into public.app_settings (setting_key, setting_value, updated_at)
  values ('active_school_year', p_year, now())
  on conflict (setting_key)
  do update set setting_value = excluded.setting_value, updated_at = now();
  return p_year;
end
$$;

create or replace function public.admin_update_profile(
  p_profile_id uuid,
  p_role text,
  p_emploi text,
  p_school_id uuid,
  p_followed_schools uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
  school_name text;
  role_function text;
  selected_school_id uuid;
  selected_school_count integer;
begin
  if not public.is_principal_admin() then
    raise exception 'Administrateur Principal required' using errcode = '42501';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'The current account cannot change its own assignment' using errcode = '42501';
  end if;

  select role::text into current_role
  from public.profiles
  where id = p_profile_id
  for update;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  if current_role = 'super_admin' then
    raise exception 'Principal administrator profiles are protected' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('titulaire', 'directeur', 'encadreur', 'chef_ceb', 'chef_personnel', 'statisticien') then
    raise exception 'Invalid function' using errcode = '22023';
  end if;

  if p_role in ('titulaire', 'directeur') then
    if p_school_id is null then
      raise exception 'A school is required for this function' using errcode = '22023';
    end if;
    select name into school_name from public.schools where id = p_school_id;
    if not found then
      raise exception 'School not found' using errcode = 'P0002';
    end if;
    selected_school_id := p_school_id;
  elsif p_role = 'encadreur' then
    if coalesce(cardinality(p_followed_schools), 0) = 0 then
      raise exception 'At least one school is required for an Encadreur' using errcode = '22023';
    end if;
    select count(*) into selected_school_count
    from public.schools
    where id = any(p_followed_schools);
    if selected_school_count <> cardinality(p_followed_schools) then
      raise exception 'One or more selected schools do not exist' using errcode = 'P0002';
    end if;
    school_name := 'CEB de Bagré';
    selected_school_id := null;
  else
    school_name := 'CEB de Bagré';
    selected_school_id := null;
  end if;

  if p_role in ('encadreur', 'chef_ceb') then
    if upper(trim(coalesce(p_emploi, ''))) <> 'IEPNF' then
      raise exception 'This function requires IEPNF' using errcode = '22023';
    end if;
  elsif upper(trim(coalesce(p_emploi, ''))) not in ('PE', 'PCE') then
    raise exception 'This function requires PE or PCE' using errcode = '22023';
  end if;

  role_function := case p_role
    when 'titulaire' then 'Agent'
    when 'directeur' then 'Directeur'
    when 'encadreur' then 'Encadreur'
    when 'chef_personnel' then 'Chef du Personnel'
    when 'statisticien' then 'Statisticien'
    when 'chef_ceb' then 'Chef de la CEB'
  end;

  update public.profiles
  set role = p_role,
      emploi = upper(trim(p_emploi)),
      fonction = role_function,
      school_id = selected_school_id,
      ecole_id = selected_school_id,
      ecole_nom = school_name,
      structure = school_name,
      ecoles_encadrees = to_jsonb(coalesce(p_followed_schools, '{}'::uuid[])),
      followed_schools = coalesce(p_followed_schools, '{}'::uuid[])
  where id = p_profile_id;
end
$$;

revoke all on function public.get_active_school_year() from public, anon;
revoke all on function public.admin_set_school_year(text) from public, anon;
revoke all on function public.admin_update_profile(uuid, text, text, uuid, uuid[]) from public, anon;
grant execute on function public.get_active_school_year() to authenticated;
grant execute on function public.admin_set_school_year(text) to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, uuid, uuid[]) to authenticated;
alter table public.registre_configs add column if not exists visa_directeur_date text;
alter table public.registre_configs add column if not exists visa_directeur_nom text;
alter table public.registre_configs add column if not exists visa_directeur_signature text;
alter table public.registre_configs add column if not exists visa_encadreur_date text;
alter table public.registre_configs add column if not exists visa_encadreur_nom text;
alter table public.registre_configs add column if not exists visa_encadreur_signature text;
alter table public.students add column if not exists date_naissance date;
alter table public.students add column if not exists option_cep text;

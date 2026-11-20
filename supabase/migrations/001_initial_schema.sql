-- ============================================================================
-- SCHÉMA INITIAL — CEB BAGRÉ (Burkina Faso)
-- ============================================================================

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ceb text not null default 'BAGRÉ',
  director_name text,
  address text,
  created_at timestamptz default now()
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null check (level in ('CP1','CP2','CE1','CE2','CM1','CM2')),
  school_id uuid references schools(id) on delete cascade,
  titulaire_id uuid references auth.users(id),
  year text not null default '2026-2027',
  subjects jsonb default '[]',
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  identifiant text unique not null,
  full_name text not null,
  whatsapp_phone text not null,
  role text not null check (role in ('titulaire','directeur','encadreur','chef_ceb')),
  school_id uuid references schools(id),
  class_id uuid references classes(id),
  followed_schools uuid[] default '{}',
  created_at timestamptz default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  full_name text not null,
  gender text not null check (gender in ('M','F')),
  status text default 'Nouveau',
  age integer,
  handicap text default '',
  edi boolean default false,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  subject_id text not null,
  term integer not null check (term in (1,2,3)),
  value numeric,
  absent boolean default false,
  evaluator_id uuid references auth.users(id),
  exam_blanc_id uuid references exam_blancs(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table exam_blancs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_id uuid references classes(id) on delete cascade,
  school_id uuid references schools(id),
  term integer not null,
  year text not null,
  evaluator_id uuid references auth.users(id),
  status text default 'brouillon' check (status in ('brouillon','termine')),
  created_at timestamptz default now()
);

create table exam_blanc_students (
  id uuid primary key default gen_random_uuid(),
  exam_blanc_id uuid references exam_blancs(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  composed boolean default true,
  unique(exam_blanc_id, student_id)
);

create table evaluator_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  school_id uuid references schools(id),
  created_by uuid references auth.users(id),
  expires_at timestamptz,
  max_uses integer default 1,
  used_count integer default 0,
  active boolean default true
);

create table convocations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date timestamptz not null,
  location text not null,
  target_roles text[] default '{}',
  target_levels text[] default '{}',
  message text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  table_name text not null,
  action text not null check (action in ('insert','update','delete')),
  payload jsonb not null,
  created_at timestamptz default now(),
  processed boolean default false
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table profiles enable row level security;
alter table schools enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table grades enable row level security;
alter table exam_blancs enable row level security;
alter table exam_blanc_students enable row level security;
alter table evaluator_codes enable row level security;
alter table convocations enable row level security;
alter table sync_queue enable row level security;

-- ============================================================================
-- POLITIQUES RLS
-- ============================================================================

create policy "profiles_own" on profiles for all using (auth.uid() = id);
create policy "profiles_read_staff" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('encadreur','chef_ceb'))
);

create policy "schools_read_all" on schools for select using (true);
create policy "schools_write_admin" on schools for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'chef_ceb')
);

create policy "classes_read_all" on classes for select using (true);
create policy "classes_write_scope" on classes for all using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid()
    and (
      (p.role = 'titulaire' and p.class_id = classes.id)
      or (p.role = 'directeur' and p.school_id = classes.school_id)
      or (p.role = 'chef_ceb')
    )
  )
);

create policy "students_read_scope" on students for select using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid()
    and (
      (p.role = 'titulaire' and p.class_id = students.class_id)
      or (p.role = 'directeur' and p.school_id = students.school_id)
      or (p.role = 'encadreur' and p.followed_schools && array[students.school_id])
      or (p.role = 'chef_ceb')
    )
  )
);
create policy "students_write_titulaire" on students for insert with check (
  exists (
    select 1 from profiles p
    where p.id = auth.uid()
    and p.role = 'titulaire'
    and p.class_id = students.class_id
  )
);
create policy "students_update_titulaire" on students for update using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid()
    and p.role = 'titulaire'
    and p.class_id = students.class_id
  )
);

create policy "grades_read_scope" on grades for select using (
  exists (
    select 1 from profiles p
    join students s on s.id = grades.student_id
    where p.id = auth.uid()
    and (
      (p.role = 'titulaire' and p.class_id = s.class_id)
      or (p.role = 'directeur' and p.school_id = s.school_id)
      or (p.role = 'encadreur' and p.followed_schools && array[s.school_id])
      or (p.role = 'chef_ceb')
    )
  )
);
create policy "grades_write_eval" on grades for insert with check (
  exists (
    select 1 from profiles p
    where p.id = auth.uid()
    and p.role in ('titulaire','directeur','encadreur','chef_ceb')
  )
);

create policy "exam_blancs_read_scope" on exam_blancs for select using (
  exists (
    select 1 from profiles p
    join classes c on c.id = exam_blancs.class_id
    where p.id = auth.uid()
    and (
      (p.role = 'titulaire' and p.class_id = c.id)
      or (p.role = 'directeur' and p.school_id = c.school_id)
      or (p.role = 'encadreur' and p.followed_schools && array[c.school_id])
      or (p.role = 'chef_ceb')
    )
  )
);
create policy "exam_blancs_write_eval" on exam_blancs for insert with check (
  exists (
    select 1 from profiles p
    where p.id = auth.uid()
    and p.role in ('titulaire','directeur','chef_ceb')
  )
);

create policy "exam_blanc_students_read_scope" on exam_blanc_students for select using (
  exists (
    select 1 from profiles p
    join exam_blancs eb on eb.id = exam_blanc_students.exam_blanc_id
    join classes c on c.id = eb.class_id
    where p.id = auth.uid()
    and (
      (p.role = 'titulaire' and p.class_id = c.id)
      or (p.role = 'directeur' and p.school_id = c.school_id)
      or (p.role = 'encadreur' and p.followed_schools && array[c.school_id])
      or (p.role = 'chef_ceb')
    )
  )
);

create policy "evaluator_codes_read_all" on evaluator_codes for select using (true);
create policy "evaluator_codes_write_chef" on evaluator_codes for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'chef_ceb')
);

create policy "convocations_read_all" on convocations for select using (true);
create policy "convocations_write_chef" on convocations for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'chef_ceb')
);

create policy "sync_queue_own" on sync_queue for all using (auth.uid() = user_id);

-- ============================================================================
-- INDEX
-- ============================================================================

create index idx_students_class on students(class_id);
create index idx_students_school on students(school_id);
create index idx_grades_student on grades(student_id);
create index idx_grades_exam on grades(exam_blanc_id);
create index idx_classes_school on classes(school_id);
create index idx_profiles_role on profiles(role);
create index idx_profiles_school on profiles(school_id);
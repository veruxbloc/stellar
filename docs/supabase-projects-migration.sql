-- Ejecutar en Supabase Dashboard → SQL Editor

-- Tabla de proyectos con escrow en RSK
create table if not exists public.projects (
  id bigserial primary key,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  description text,
  amount_rbtc numeric not null,
  deadline_days int not null,
  student_wallet text,
  contract_project_id int,
  tx_hash text,
  status text default 'open' check (status in ('open', 'active', 'delivered', 'completed', 'disputed')),
  created_at timestamptz default now()
);

-- Tabla de postulaciones
create table if not exists public.applications (
  id bigserial primary key,
  project_id bigint references public.projects(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  match_score int,
  match_reason text,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now()
);

-- Agregar columna verified a certificates si no existe
alter table public.certificates add column if not exists verified boolean default false;
alter table public.certificates add column if not exists name text;
alter table public.certificates add column if not exists institution text;
alter table public.certificates add column if not exists year int;

-- RLS
alter table public.projects enable row level security;
alter table public.applications enable row level security;

-- Empresas gestionan sus proyectos
create policy "projects: company manage" on public.projects for all using (
  company_id in (select id from public.companies where user_id = auth.uid())
);
-- Todos leen proyectos abiertos
create policy "projects: all read" on public.projects for select using (true);

-- Estudiantes gestionan sus postulaciones
create policy "applications: student manage" on public.applications for all using (
  student_id in (select id from public.students where user_id = auth.uid())
);
-- Empresas leen postulaciones de sus proyectos
create policy "applications: company read" on public.applications for select using (
  project_id in (
    select id from public.projects where company_id in (
      select id from public.companies where user_id = auth.uid()
    )
  )
);

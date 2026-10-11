-- Domain scan table (also used for caching results)
create table public.domain_scans (
    id uuid primary key default gen_random_uuid(),
    domain text not null,
    result jsonb not null,
    created_at timestamptz not null default now()
);

alter table public.domain_scans enable row level security;

-- Repo scan table (also used for caching result)
create table public.repo_scans (
    id uuid primary key default gen_random_uuid(),
    github_repo text not null,
    commit_sha text not null,
    result jsonb not null,
    created_at timestamptz not null default now()
);

alter table public.repo_scans enable row level security;

-- Scan table 
create table public.scans (
    id uuid primary key default gen_random_uuid(),
    domain_scan_id uuid references public.domain_scans (id) on delete set null,
    repo_scan_id uuid references public.repo_scans (id) on delete set null,
    project_id uuid references public.projects (id) on delete cascade,
    user_id uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    constraint scans_has_target check (domain_scan_id is not null or repo_scan_id is not null)
);

alter table public.scans enable row level security;

grant select, insert, update, delete on public.domain_scans, public.repo_scans, public.scans to service_role;
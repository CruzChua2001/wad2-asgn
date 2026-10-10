-- Project table
-- Must track at least a github repo or a domain
create table public.projects (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 1 and 60),
    domain text check (domain <> ''),
    github_repo text check (github_repo <> ''),
    created_by uuid default auth.uid() references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    constraint projects_has_target check (domain is not null or github_repo is not null)
);

alter table public.projects enable row level security;

-- Project Members
-- Role: Owner (can scan), Viewer (cannot scan)
create table public.project_members (
    project_id uuid not null references public.projects (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    role text not null check (role in ('owner', 'viewer')),
    created_at timestamptz not null default now(),
    primary key (project_id, user_id)
);

create index project_members_user_id_idx on public.project_members (user_id);

alter table public.project_members enable row level security;

-- Project email invites. No need to have an account yet.
create table public.project_invites (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    email text not null check (email = lower(email)),
    role text not null check (role in ('owner', 'viewer')),
    invited_by uuid default auth.uid() references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default now() + interval '7 days',
    unique (project_id, email)
);

create index project_invites_email_idx on public.project_invites (email);

alter table public.project_invites enable row level security;

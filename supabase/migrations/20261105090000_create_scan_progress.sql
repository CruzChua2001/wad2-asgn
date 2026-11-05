-- A user's ticks on the Fix guide and Checklist tabs: one row per user per scan.
-- fixed: { "<finding id>": true }, checklist: { "<checklist item id>": true }
create table public.scan_progress (
    scan_id uuid not null references public.scans (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    fixed jsonb not null default '{}'::jsonb,
    checklist jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (scan_id, user_id)
);

-- AI step-by-step guides, saved so they are not rewritten (and survive a server restart).
-- Findings are not stored, so fingerprint (a hash of the finding's text) tells us when a saved guide is out of date.
create table public.finding_guides (
    scan_id uuid not null references public.scans (id) on delete cascade,
    finding_id text not null,
    fingerprint text not null,
    guide text not null,
    created_at timestamptz not null default now(),
    primary key (scan_id, finding_id)
);

alter table public.scan_progress enable row level security;
alter table public.finding_guides enable row level security;

grant select, insert, update, delete on public.scan_progress, public.finding_guides to service_role;

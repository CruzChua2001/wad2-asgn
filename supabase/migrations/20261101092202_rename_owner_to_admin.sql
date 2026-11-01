alter table public.project_members drop constraint project_members_role_check;
alter table public.project_invites drop constraint project_invites_role_check;

update public.project_members set role = 'admin' where role = 'owner';
update public.project_invites set role = 'admin' where role = 'owner';

alter table public.project_members add constraint project_members_role_check check (role in ('admin', 'viewer'));
alter table public.project_invites add constraint project_invites_role_check check (role in ('admin', 'viewer'));
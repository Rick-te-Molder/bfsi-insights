-- Seed data for local development
insert into public.regulation(code,title) values ('eidas','eIDAS') on conflict do nothing;

-- Migration: Insert Jo O'Kelly as admin user

insert into public.users (id, email, role, full_name, phone)
values (
  (select id from auth.users where email = 'jo@results2go.com'),
  'jo@results2go.com',
  'admin',
  'Jo O''Kelly',
  '931308334'
);

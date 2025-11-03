insert into public.users (id, email, full_name, role, phone) select id, email, 'Natalie O''Kelly', 'admin', '966318871' from auth.users where email = 'natalie@nhomesetup.com';

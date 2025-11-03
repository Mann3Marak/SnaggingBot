-- Migration: Install pg_net extension for database webhooks

create extension if not exists pg_net with schema net;

grant usage on schema net to anon, authenticated, service_role, postgres;
grant execute on all functions in schema net to service_role, postgres;

alter default privileges in schema net
  grant execute on functions to service_role;

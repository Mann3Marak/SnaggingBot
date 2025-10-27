-- Migration: Enable HTTP extension for Supabase triggers
-- This extension allows Postgres to make HTTP requests (used by net.http_post)

-- Enable the http extension (provides net.http_post)
create extension if not exists http with schema extensions;

-- Verify the extension is available
select * from pg_available_extensions where name = 'http';

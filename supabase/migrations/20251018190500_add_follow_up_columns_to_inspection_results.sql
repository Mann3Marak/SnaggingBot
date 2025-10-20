-- Migration: Add follow-up tracking columns to inspection_results
-- Created on 2025-10-18

alter table inspection_results
add column if not exists follow_up_fixed boolean default false,
add column if not exists follow_up_comment text,
add column if not exists follow_up_updated_at timestamp with time zone default timezone('utc', now());

comment on column inspection_results.follow_up_fixed is 'Indicates whether the issue has been fixed during follow-up inspection';
comment on column inspection_results.follow_up_comment is 'Inspector comments or notes added during follow-up inspection';
comment on column inspection_results.follow_up_updated_at is 'Timestamp of the last follow-up update';

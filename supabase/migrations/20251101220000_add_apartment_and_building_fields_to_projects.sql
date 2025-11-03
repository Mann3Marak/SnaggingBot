-- Add apartment_types and building_numbers columns to projects table
alter table if exists projects
add column if not exists apartment_types text[] default '{}',
add column if not exists building_numbers text[] default '{}';

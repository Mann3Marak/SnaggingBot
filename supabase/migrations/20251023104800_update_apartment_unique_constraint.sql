-- Migration: Update apartment unique constraint to include building_number
-- This allows the same unit_number to exist in different buildings within the same project

-- Drop the old unique index
drop index if exists uq_apartments_project_unit;

-- Create a new unique index that includes building_number
create unique index if not exists uq_apartments_project_building_unit
on apartments (project_id, building_number, lower(unit_number));

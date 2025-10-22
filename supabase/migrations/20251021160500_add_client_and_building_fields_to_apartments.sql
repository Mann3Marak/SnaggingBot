-- Migration: Add client and building fields to apartments table
-- Created: 2025-10-21 16:05

ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS client_surname TEXT,
ADD COLUMN IF NOT EXISTS building_number TEXT;

-- Verify columns were added
COMMENT ON COLUMN apartments.client_name IS 'Client first name';
COMMENT ON COLUMN apartments.client_surname IS 'Client last name';
COMMENT ON COLUMN apartments.building_number IS 'Building number for the apartment';

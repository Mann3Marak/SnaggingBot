-- Migration: Add room_type_pt and item_description_pt columns to checklist_templates table

alter table public.checklist_templates
add column if not exists room_type_pt text,
add column if not exists item_description_pt text;

-- Optional: backfill existing data if needed (currently left empty)
-- update public.checklist_templates
-- set room_type_pt = room_type, item_description_pt = item_description
-- where room_type_pt is null and item_description_pt is null;

-- Refresh schema cache
notify pgrst, 'reload schema';

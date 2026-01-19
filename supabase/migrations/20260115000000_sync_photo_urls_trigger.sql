-- Migration: Sync photo_urls in inspection_results when photos are added to nhome_photos
-- Date: 2026-01-15
-- Purpose: Automatically keep inspection_results.photo_urls in sync with nhome_photos table
-- This prevents photos from being "orphaned" and ensures PDF reports always show correct photos

-- Create function to sync photo URLs
CREATE OR REPLACE FUNCTION sync_photo_urls_on_photo_change()
RETURNS TRIGGER AS $$
BEGIN
  -- For INSERT and UPDATE operations, use NEW
  -- For DELETE operations, use OLD
  DECLARE
    target_session_id UUID;
    target_item_id UUID;
  BEGIN
    -- Determine which session and item to update
    IF TG_OP = 'DELETE' THEN
      target_session_id := OLD.session_id;
      target_item_id := OLD.item_id;
    ELSE
      target_session_id := NEW.session_id;
      target_item_id := NEW.item_id;
    END IF;

    -- Update the corresponding inspection_results record(s)
    -- with all current photo URLs for this item
    UPDATE inspection_results
    SET photo_urls = (
      SELECT array_agg(supabase_url ORDER BY created_at)
      FROM nhome_photos
      WHERE session_id = target_session_id
        AND item_id = target_item_id
    )
    WHERE session_id = target_session_id
      AND item_id = target_item_id;

    -- Return the appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
CREATE TRIGGER trigger_sync_photo_urls_on_insert
AFTER INSERT ON nhome_photos
FOR EACH ROW
EXECUTE FUNCTION sync_photo_urls_on_photo_change();

-- Create trigger for DELETE operations
-- (in case photos are deleted, remove them from inspection_results.photo_urls)
CREATE TRIGGER trigger_sync_photo_urls_on_delete
AFTER DELETE ON nhome_photos
FOR EACH ROW
EXECUTE FUNCTION sync_photo_urls_on_photo_change();

-- Optional: Create trigger for UPDATE operations
-- (in case supabase_url is changed)
CREATE TRIGGER trigger_sync_photo_urls_on_update
AFTER UPDATE OF supabase_url ON nhome_photos
FOR EACH ROW
WHEN (OLD.supabase_url IS DISTINCT FROM NEW.supabase_url)
EXECUTE FUNCTION sync_photo_urls_on_photo_change();

-- Comment explaining the triggers
COMMENT ON FUNCTION sync_photo_urls_on_photo_change() IS
  'Automatically synchronizes inspection_results.photo_urls when photos are added, updated, or deleted in nhome_photos table';

COMMENT ON TRIGGER trigger_sync_photo_urls_on_insert ON nhome_photos IS
  'Automatically adds photo URL to inspection_results.photo_urls when a new photo is inserted';

COMMENT ON TRIGGER trigger_sync_photo_urls_on_delete ON nhome_photos IS
  'Automatically removes photo URL from inspection_results.photo_urls when a photo is deleted';

COMMENT ON TRIGGER trigger_sync_photo_urls_on_update ON nhome_photos IS
  'Automatically updates photo URL in inspection_results.photo_urls when supabase_url changes';

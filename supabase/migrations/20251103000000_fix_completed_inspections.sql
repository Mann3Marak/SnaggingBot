-- Fix inspection sessions that should be marked as completed
-- An inspection is completed when current_item_index >= total checklist items for that apartment type

UPDATE inspection_sessions
SET
  status = 'completed',
  completed_at = COALESCE(completed_at, now())
WHERE
  status != 'completed'
  AND id IN (
    SELECT s.id
    FROM inspection_sessions s
    INNER JOIN apartments a ON s.apartment_id = a.id
    INNER JOIN (
      SELECT apartment_type, COUNT(*) as total_items
      FROM checklist_templates
      GROUP BY apartment_type
    ) ct ON a.apartment_type = ct.apartment_type
    WHERE s.current_item_index >= ct.total_items
  );

import { createClient } from "@supabase/supabase-js";

/**
 * NHome Inspection State Manager
 * --------------------------------
 * This module centralizes logic for managing inspection progress and item updates.
 * It allows the voice agent or frontend to:
 * - Retrieve the current inspection item
 * - Move to the next item
 * - Mark items as good, issue, or critical
 * - Add comments
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

/**
 * Get the current inspection item for a given session.
 */
export async function getCurrentItem(sessionId: string) {
  const { data, error } = await supabase
    .from("inspection_results")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

/**
 * Move to the next inspection item in sequence.
 * Returns the next item or null if at the end.
 * This function is now re-enabled for controlled automatic movement.
 */
export async function moveToNextItem(sessionId: string, currentItemId: string) {
  const { data: items, error } = await supabase
    .from("inspection_results")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!items || items.length === 0) return null;

  const currentIndex = items.findIndex((i) => i.id === currentItemId);
  const nextItem = currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  if (nextItem) {
    await supabase
      .from("inspection_sessions")
      .update({ current_item_index: currentIndex + 1 })
      .eq("id", sessionId);
  }

  return nextItem;
}

/**
 * Mark an item as good.
 */
export async function markItemAsGood(sessionId: string, itemId: string) {
  const { error } = await supabase
    .from("inspection_results")
    .update({ status: "good", follow_up_fixed: true, follow_up_comment: null })
    .eq("id", itemId)
    .eq("session_id", sessionId);

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Mark an item as issue or critical, with optional comment.
 */
export async function markItemAsIssue(sessionId: string, itemId: string, comment?: string) {
  const { error } = await supabase
    .from("inspection_results")
    .update({
      status: "issue",
      follow_up_fixed: false,
      follow_up_comment: comment || null,
    })
    .eq("id", itemId)
    .eq("session_id", sessionId);

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Add or update a comment for an item.
 */
export async function addComment(sessionId: string, itemId: string, comment: string) {
  const { error } = await supabase
    .from("inspection_results")
    .update({ follow_up_comment: comment })
    .eq("id", itemId)
    .eq("session_id", sessionId);

  if (error) throw new Error(error.message);
  return true;
}

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createServiceClient } from '@/lib/server/apiAuth';

/**
 * One-time fix endpoint to mark inspection sessions as completed
 * when all checklist items have been inspected
 * ADMIN-ONLY: Affects all sessions across all companies
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin role for this maintenance endpoint
    const { user } = await requireRole(request, ['admin']);

    console.info('[Fix Completed Sessions] Starting maintenance operation', {
      userId: user.id,
    });

    const supabase = createServiceClient({
      userId: user.id,
      route: request.nextUrl.pathname,
    });

    // Get all inspection sessions that are not completed
    const { data: sessions, error: sessionsError } = await supabase
      .from('inspection_sessions')
      .select('id, apartment_id, current_item_index, status')
      .neq('status', 'completed');

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    const updates: any[] = [];

    for (const session of sessions || []) {
      // Get apartment type
      const { data: apartment } = await supabase
        .from('apartments')
        .select('apartment_type')
        .eq('id', session.apartment_id)
        .single();

      if (!apartment) continue;

      // Get total checklist items for this apartment type
      const { data: checklist, count } = await supabase
        .from('checklist_templates')
        .select('*', { count: 'exact', head: true })
        .eq('apartment_type', apartment.apartment_type);

      const totalItems = count || 0;

      // If current_item_index >= totalItems, mark as completed
      if (session.current_item_index >= totalItems) {
        const { error: updateError } = await supabase
          .from('inspection_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        if (!updateError) {
          updates.push({
            session_id: session.id,
            old_status: session.status,
            new_status: 'completed',
            current_item_index: session.current_item_index,
            total_items: totalItems,
          });
        }
      }
    }

    console.info('[Fix Completed Sessions] Maintenance operation completed', {
      updatedSessions: updates.length,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: `Fixed ${updates.length} inspection session(s)`,
      updates,
    });
  } catch (error: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error;
    }

    console.error('[Fix Completed Sessions] Maintenance operation failed', {
      error: error.message,
    });
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

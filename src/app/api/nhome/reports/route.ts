import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET(_request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies }) as any

  const { data: sessions, error: sessionsError } = await supabase
    .from('inspection_sessions')
    .select(
      'id, apartment_id, inspector_id, report_url_pt, report_url_en, photo_package_url, report_generated_at, inspection_type, completed_at',
    )
    .not('report_url_pt', 'is', null)
    .order('report_generated_at', { ascending: false })
    .limit(25)

  if (sessionsError) {
    console.error('Failed to load NHome reports', sessionsError)
    return NextResponse.json({ error: 'Failed to load NHome reports' }, { status: 500 })
  }

  const sessionList = sessions ?? []
  if (sessionList.length === 0) {
    return NextResponse.json({ reports: [] })
  }

  const apartmentIds = Array.from(new Set(sessionList.map((item: any) => item.apartment_id).filter(Boolean)))

  let apartmentMap = new Map<string, any>()
  let projectMap = new Map<string, any>()

  if (apartmentIds.length > 0) {
    const { data: apartments, error: apartmentsError } = await supabase
      .from('apartments')
      .select('id, unit_number, apartment_type, project_id')
      .in('id', apartmentIds)

    if (apartmentsError) {
      console.error('Failed to load NHome apartments for reports', apartmentsError)
      return NextResponse.json({ error: 'Failed to load report apartments' }, { status: 500 })
    }

    apartmentMap = new Map((apartments ?? []).map((apt: any) => [apt.id, apt]))

    const projectIds = Array.from(new Set((apartments ?? []).map((apt: any) => apt.project_id).filter(Boolean)))
    if (projectIds.length > 0) {
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, developer_name')
        .in('id', projectIds)

      if (projectsError) {
        console.error('Failed to load NHome projects for reports', projectsError)
        return NextResponse.json({ error: 'Failed to load report projects' }, { status: 500 })
      }

      projectMap = new Map((projects ?? []).map((proj: any) => [proj.id, proj]))
    }
  }

  const { data: shareLogs, error: sharesError } = await supabase
    .from('nhome_sharing_log')
    .select('session_id, share_url, shared_at, client_email, shared_by, access_count')
    .in('session_id', sessionList.map((session: any) => session.id))
    .order('shared_at', { ascending: false })

  if (sharesError) {
    console.error('Failed to load NHome share logs', sharesError)
  }

  const shareGroups = new Map<string, any[]>()
  ;(shareLogs ?? []).forEach((share: any) => {
    if (!shareGroups.has(share.session_id)) {
      shareGroups.set(share.session_id, [])
    }
    shareGroups.get(share.session_id)!.push(share)
  })

  const reports = sessionList.map((session: any) => {
    const apartment = session.apartment_id ? apartmentMap.get(session.apartment_id) : null
    const project = apartment?.project_id ? projectMap.get(apartment.project_id) : null
    const sessionShares = shareGroups.get(session.id) ?? []
    const latestShare = sessionShares[0] ?? null

    return {
      id: session.id,
      inspection_type: session.inspection_type,
      completed_at: session.completed_at,
      report_generated_at: session.report_generated_at,
      report_url_pt: session.report_url_pt,
      report_url_en: session.report_url_en,
      photo_package_url: session.photo_package_url,
      apartment: apartment
        ? { unit_number: apartment.unit_number, apartment_type: apartment.apartment_type }
        : null,
      project: project ? { name: project.name, developer_name: project.developer_name } : null,
      share_summary: latestShare
        ? {
            share_url: latestShare.share_url,
            shared_at: latestShare.shared_at,
            client_email: latestShare.client_email,
            shared_by: latestShare.shared_by,
            access_count: latestShare.access_count,
          }
        : null,
      total_shares: sessionShares.length,
    }
  })

  return NextResponse.json({ reports })
}

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { NHomeLogo } from '@/components/NHomeLogo'

export const dynamic = 'force-dynamic'

type ShareRecord = {
  id: string
  session_id: string | null
  client_email: string | null
  share_url: string
  shared_at: string
  shared_by: string
  access_count: number | null
}

type SessionRecord = {
  id: string
  apartment_id: string | null
  report_url_pt: string | null
  report_url_en: string | null
  photo_package_url: string | null
  report_generated_at: string | null
  inspection_type: string | null
  completed_at: string | null
}

type ApartmentRecord = {
  id: string
  unit_number: string | null
  apartment_type: string | null
  project_id: string | null
}

type ProjectRecord = {
  id: string
  name: string
  developer_name: string
}

type SharePageData = {
  share: ShareRecord
  session: SessionRecord | null
  apartment: ApartmentRecord | null
  project: ProjectRecord | null
}

async function loadSharePageData(token: string): Promise<SharePageData | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('NHome share portal missing Supabase configuration')
    return null
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const sharePath = `/inspection/share/${token}`

  const { data: share, error: shareError } = await supabase
    .from('nhome_sharing_log')
    .select<ShareRecord>('*')
    .eq('share_url', sharePath)
    .maybeSingle()

  if (shareError) {
    console.error('NHome share portal failed to load share log', shareError)
    return null
  }

  if (!share) {
    return null
  }

  let session: SessionRecord | null = null
  if (share.session_id) {
    const { data: sessionRecord, error: sessionError } = await supabase
      .from('inspection_sessions')
      .select<SessionRecord>(
        'id, apartment_id, report_url_pt, report_url_en, photo_package_url, report_generated_at, inspection_type, completed_at',
      )
      .eq('id', share.session_id)
      .maybeSingle()

    if (sessionError) {
      console.error('NHome share portal failed to load session', sessionError)
    } else {
      session = sessionRecord
    }
  }

  let apartment: ApartmentRecord | null = null
  let project: ProjectRecord | null = null

  if (session?.apartment_id) {
    const { data: apartmentRecord, error: apartmentError } = await supabase
      .from('apartments')
      .select<ApartmentRecord>('id, unit_number, apartment_type, project_id')
      .eq('id', session.apartment_id)
      .maybeSingle()

    if (apartmentError) {
      console.error('NHome share portal failed to load apartment', apartmentError)
    } else {
      apartment = apartmentRecord
    }

    if (apartment?.project_id) {
      const { data: projectRecord, error: projectError } = await supabase
        .from('projects')
        .select<ProjectRecord>('id, name, developer_name')
        .eq('id', apartment.project_id)
        .maybeSingle()

      if (projectError) {
        console.error('NHome share portal failed to load project', projectError)
      } else {
        project = projectRecord
      }
    }
  }

  const nextAccessCount = (share.access_count ?? 0) + 1

  const { error: updateError } = await supabase
    .from('nhome_sharing_log')
    .update({ access_count: nextAccessCount })
    .eq('id', share.id)

  if (updateError) {
    console.error('NHome share portal failed to update access count', updateError)
  } else {
    share.access_count = nextAccessCount
  }

  return { share, session, apartment, project }
}

function formatDisplayDate(value: string | null) {
  if (!value) return 'Pending'
  const formatter = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  return formatter.format(new Date(value))
}

function formatInspectionLabel(type: string | null) {
  if (!type) return 'Initial Inspection'
  if (type === 'follow_up') {
    return 'Follow-up Inspection'
  }
  return type.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export default async function NHomeClientSharePage({ params }: { params: { token: string } }) {
  const data = await loadSharePageData(params.token)

  if (!data) {
    notFound()
  }

  const { share, session, apartment, project } = data

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-xl border border-gray-100 rounded-3xl overflow-hidden">
        <div className="bg-nhome-primary text-white p-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <NHomeLogo variant="light" size="md" />
            <div className="text-left">
              <p className="text-xs uppercase tracking-wide">NHome Client Delivery</p>
              <h1 className="text-2xl font-semibold">Professional Inspection Package</h1>
            </div>
          </div>
          <p className="text-sm text-white/80 max-w-xl mx-auto">
            This secure portal gives you access to the bilingual inspection reports and professional photo package
            prepared by the NHome Property Setup & Management team.
          </p>
        </div>

        <div className="p-8 space-y-8">
          <section className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Overview</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Project</dt>
                <dd className="text-gray-900 font-medium">{project?.name ?? 'NHome Inspection Project'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Developer</dt>
                <dd className="text-gray-900 font-medium">{project?.developer_name ?? 'Natalie O\'Kelly'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Apartment</dt>
                <dd className="text-gray-900 font-medium">{apartment?.unit_number ?? 'Residence'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Inspection Type</dt>
                <dd className="text-gray-900 font-medium">{formatInspectionLabel(session?.inspection_type ?? null)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Report Generated</dt>
                <dd className="text-gray-900 font-medium">{formatDisplayDate(session?.report_generated_at ?? null)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Shared On</dt>
                <dd className="text-gray-900 font-medium">{formatDisplayDate(share.shared_at)}</dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Download Professional Reports</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href={session?.report_url_pt ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-2xl border px-6 py-4 transition ${
                  session?.report_url_pt
                    ? 'border-nhome-primary/30 bg-nhome-primary/5 text-nhome-primary hover:bg-nhome-primary/10'
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <div className="text-sm font-semibold mb-1">Portuguese Report</div>
                <p className="text-xs">
                  {session?.report_url_pt
                    ? 'Download the Portuguese professional inspection report with localized terminology.'
                    : 'Available once the inspection report has been generated.'}
                </p>
              </a>
              <a
                href={session?.report_url_en ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-2xl border px-6 py-4 transition ${
                  session?.report_url_en
                    ? 'border-nhome-secondary/30 bg-nhome-secondary/5 text-nhome-secondary hover:bg-nhome-secondary/10'
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <div className="text-sm font-semibold mb-1">English Report</div>
                <p className="text-xs">
                  {session?.report_url_en
                    ? 'Download the English professional inspection report for international stakeholders.'
                    : 'Available once the inspection report has been generated.'}
                </p>
              </a>
            </div>
          </section>

          <section className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Professional Photo Package</h2>
            <p className="text-sm text-gray-600 mb-4">
              Access the organized OneDrive folder containing all professional photos and annotations captured during
              the inspection process.
            </p>
            <a
              href={session?.photo_package_url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition ${
                session?.photo_package_url
                  ? 'bg-nhome-accent text-white hover:bg-nhome-accent-dark'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {session?.photo_package_url ? 'Open OneDrive Photo Collection' : 'Photos will appear once shared'}
            </a>
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">NHome Delivery Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Shared By</p>
                <p className="text-gray-900 font-medium">{share.shared_by}</p>
              </div>
              <div>
                <p className="text-gray-500">Client Email</p>
                <p className="text-gray-900 font-medium">{share.client_email ?? 'Shared via secure link'}</p>
              </div>
              <div>
                <p className="text-gray-500">Portal Visits</p>
                <p className="text-gray-900 font-medium">{share.access_count ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-500">Inspection Completion</p>
                <p className="text-gray-900 font-medium">{formatDisplayDate(session?.completed_at ?? null)}</p>
              </div>
            </div>
          </section>

          <section className="bg-nhome-primary/5 border border-nhome-primary/20 rounded-2xl p-6 text-sm text-gray-700">
            <h2 className="text-lg font-semibold text-nhome-primary mb-3">Need Assistance?</h2>
            <p className="mb-2">
              For any questions about this inspection package, please contact the NHome concierge team. We provide
              bilingual support for property developers, investors, and new homeowners across the Algarve.
            </p>
            <p className="font-medium text-nhome-primary">concierge@nhomesetup.com - +351 910 000 000</p>
          </section>
        </div>

        <div className="bg-gray-900 text-white text-center py-4 text-xs tracking-wide uppercase">
          NHome Property Setup & Management - Professional Property Services in the Algarve
        </div>
      </div>
    </div>
  )
}

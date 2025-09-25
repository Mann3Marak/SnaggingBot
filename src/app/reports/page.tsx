"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { NHomeLogo } from '@/components/NHomeLogo'

interface ReportListing {
  id: string
  inspection_type: string | null
  completed_at: string | null
  report_generated_at: string | null
  report_url_pt: string | null
  report_url_en: string | null
  photo_package_url: string | null
  apartment: { unit_number: string | null; apartment_type: string | null } | null
  project: { name: string | null; developer_name: string | null } | null
  share_summary: {
    share_url: string
    shared_at: string | null
    client_email: string | null
    shared_by: string | null
    access_count: number | null
  } | null
  total_shares: number
}

function formatDate(value: string | null) {
  if (!value) return 'Pending'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatInspectionType(value: string | null) {
  if (!value) return 'Initial'
  return value.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/nhome/reports', { cache: 'no-store' })
      if (!response.ok) {
        const details = await response.json().catch(() => ({}))
        throw new Error(details?.error || 'Failed to load inspection reports')
      }
      const payload = await response.json()
      setReports(payload?.reports ?? [])
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load inspection reports')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <NHomeLogo variant="primary" size="md" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Inspection Reports</h1>
              <p className="text-sm text-gray-600">Track bilingual reports, photo packages, and client shares across the NHome portfolio.</p>
            </div>
          </div>
          <button
            onClick={loadReports}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-nhome-primary text-white text-sm font-medium rounded-lg shadow hover:bg-nhome-primary-dark disabled:bg-gray-400"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {loading && reports.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-600">
            Loading professional reports...
          </div>
        )}

        {!loading && reports.length === 0 && !error && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-600">
            No completed inspection reports yet. Generate a report from an active inspection to see it here.
          </div>
        )}

        {reports.map((report) => (
          <div key={report.id} className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-nhome-primary/10 to-nhome-secondary/10 px-6 py-4 flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs uppercase text-gray-500">Property</p>
                <p className="text-lg font-semibold text-gray-900">
                  {report.project?.name ?? 'NHome Inspection'}
                  <span className="text-sm text-gray-500 ml-2">
                    {report.apartment?.unit_number ? `Unit ${report.apartment.unit_number}` : 'Unit TBD'}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Inspection Type</p>
                <p className="font-medium text-gray-900">{formatInspectionType(report.inspection_type)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Completed</p>
                <p className="font-medium text-gray-900">{formatDate(report.completed_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Report Generated</p>
                <p className="font-medium text-gray-900">{formatDate(report.report_generated_at)}</p>
              </div>
            </div>

            <div className="px-6 py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ReportLinkCard
                  title="Portuguese Report"
                  description="Localized report with Algarve-specific terminology."
                  href={report.report_url_pt}
                  accent="primary"
                />
                <ReportLinkCard
                  title="English Report"
                  description="International-ready report for investors and partners."
                  href={report.report_url_en}
                  accent="secondary"
                />
                <ReportLinkCard
                  title="Photo Package"
                  description="Organized OneDrive collection with professional photos."
                  href={report.photo_package_url}
                  accent="accent"
                />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Client Sharing</h3>
                {report.share_summary ? (
                  <div className="flex flex-wrap items-center gap-6 text-sm text-gray-700">
                    <div>
                      <span className="font-medium text-gray-900">Shared With:</span>{' '}
                      {report.share_summary.client_email ?? 'Secure link'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Shared By:</span>{' '}
                      {report.share_summary.shared_by ?? 'NHome Team'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Shared On:</span>{' '}
                      {formatDate(report.share_summary.shared_at)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Portal Visits:</span>{' '}
                      {report.share_summary.access_count ?? 0}
                    </div>
                    <Link
                      href={report.share_summary.share_url}
                      className="inline-flex items-center px-3 py-1.5 bg-nhome-primary text-white rounded-full text-xs font-semibold hover:bg-nhome-primary-dark"
                    >
                      View Client Portal
                    </Link>
                    <div className="text-xs text-gray-500">Total shares logged: {report.total_shares}</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    This report has not been shared yet. Use the report generator to deliver the package to clients.
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ReportLinkCardProps {
  title: string
  description: string
  href: string | null
  accent: 'primary' | 'secondary' | 'accent'
}

function ReportLinkCard({ title, description, href, accent }: ReportLinkCardProps) {
  const enabled = Boolean(href)
  const accentMap: Record<ReportLinkCardProps['accent'], string> = {
    primary: 'border-nhome-primary/30 bg-nhome-primary/5 text-nhome-primary hover:bg-nhome-primary/10',
    secondary: 'border-nhome-secondary/30 bg-nhome-secondary/5 text-nhome-secondary hover:bg-nhome-secondary/10',
    accent: 'border-nhome-accent/30 bg-nhome-accent/5 text-nhome-accent hover:bg-nhome-accent/10',
  }

  return (
    <a
      href={enabled ? href ?? undefined : '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-2xl border px-5 py-4 transition ${
        enabled ? accentMap[accent] : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
      }`}
    >
      <div className="text-sm font-semibold mb-1">{title}</div>
      <p className="text-xs leading-relaxed">{description}</p>
    </a>
  )
}

"use client"
import { useState } from 'react'
import { uploadNHomeReportToSupabase } from '@/lib/nhome-supabase-reports'
import { NHomeLogo } from '@/components/NHomeLogo'
import { pdf } from '@react-pdf/renderer'
import { NHomeReportTemplateEN } from '@/components/reports/NHomeReportTemplateEN'
import { NHomeReportTemplatePT } from '@/components/reports/NHomeReportTemplatePT'

interface NHomeReportGeneratorProps {
  sessionId: string
  sessionData: any
}

// Fetch image from URL and convert to base64 data URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()

    // Skip very large images (over 1MB)
    if (blob.size > 1024 * 1024) {
      console.warn(`[ReportGenerator] Skipping large image: ${(blob.size / 1024).toFixed(0)}KB`)
      return null
    }

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('[ReportGenerator] Failed to fetch image:', e)
    return null
  }
}

export default function NHomeReportGenerator({ sessionId, sessionData }: NHomeReportGeneratorProps) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [reportUrls, setReportUrls] = useState<{ portuguese?: string; english?: string; photoPackage?: string }>({})
  const [error, setError] = useState<string>('')
  const [clientEmail, setClientEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  // Fetch report data including photos from API
  const fetchReportData = async () => {
    const response = await fetch(`/api/nhome/inspections/${sessionId}/report-data`)
    if (!response.ok) {
      throw new Error('Failed to fetch report data')
    }
    return response.json()
  }

  // Pre-fetch all images as base64 and attach to results
  const prepareReportDataWithImages = async (reportData: any, onProgress?: (pct: number) => void): Promise<any> => {
    const results = reportData.results || []
    const totalPhotos = results.reduce((sum: number, r: any) => sum + (r.preview_photos?.length || 0), 0)
    let processedPhotos = 0

    console.log(`[ReportGenerator] Pre-fetching ${totalPhotos} images as base64...`)

    const resultsWithBase64 = await Promise.all(
      results.map(async (result: any) => {
        const photos = result.preview_photos || []
        const base64Urls: string[] = []

        for (const photo of photos) {
          if (photo.url) {
            const base64 = await fetchImageAsBase64(photo.url)
            if (base64) {
              base64Urls.push(base64)
            }
          }
          processedPhotos++
          if (onProgress && totalPhotos > 0) {
            onProgress(Math.round((processedPhotos / totalPhotos) * 100))
          }
        }

        return {
          ...result,
          photo_base64_urls: base64Urls,
        }
      })
    )

    console.log(`[ReportGenerator] Pre-fetched ${resultsWithBase64.filter(r => r.photo_base64_urls.length > 0).length} items with images`)

    return {
      ...reportData,
      results: resultsWithBase64,
    }
  }

  // Client-side PDF generation - works reliably with images
  const generatePDFClientSide = async (lang: 'en' | 'pt', reportData: any): Promise<Blob> => {
    console.log(`[ReportGenerator] Generating ${lang} PDF client-side...`)
    const Template = lang === 'pt' ? NHomeReportTemplatePT : NHomeReportTemplateEN
    const doc = <Template data={reportData} />
    const blob = await pdf(doc).toBlob()
    console.log(`[ReportGenerator] ${lang} PDF generated: ${(blob.size / 1024).toFixed(1)}KB`)
    return blob
  }

  const generatePDFServerSide = async (lang: 'en' | 'pt'): Promise<Blob> => {
    console.log(`[ReportGenerator] Generating ${lang} PDF server-side...`)
    const response = await fetch(`/api/nhome/inspections/${sessionId}/generate-pdf?lang=${lang}`, {
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`Server-side PDF failed (${lang})`)
    }
    const blob = await response.blob()
    console.log(`[ReportGenerator] ${lang} PDF (server) generated: ${(blob.size / 1024).toFixed(1)}KB`)
    return blob
  }

  const generateNHomeReports = async () => {
    console.log('[ReportGenerator] Button clicked! Starting client-side PDF generation...')
    console.log('[ReportGenerator] Session ID:', sessionId)

    setGenerating(true)
    setProgress(0)
    setError('')

    try {
      // Step 1: Fetch report data including photos
      console.log('[ReportGenerator] Step 1: Fetching report data with photos...')
      setProgress(5)
      const rawReportData = await fetchReportData()
      console.log(`[ReportGenerator] Report data fetched: ${rawReportData.results?.length || 0} items`)

      const itemCount = rawReportData.results?.length || 0
      const useServerSide = itemCount >= 80

      let portugueseBlob: Blob
      let englishBlob: Blob

      if (useServerSide) {
        console.log('[ReportGenerator] Using server-side PDF generation (large dataset)')
        setProgress(20)
        console.log('[ReportGenerator] Step 2: Generating Portuguese PDF server-side...')
        portugueseBlob = await generatePDFServerSide('pt')
        setProgress(50)
        console.log('[ReportGenerator] Step 3: Generating English PDF server-side...')
        englishBlob = await generatePDFServerSide('en')
      } else {
        // Step 2: Pre-fetch all images as base64
        console.log('[ReportGenerator] Step 2: Pre-fetching images as base64...')
        setProgress(10)
        const reportData = await prepareReportDataWithImages(rawReportData, (imgProgress) => {
          // Map image progress (0-100) to overall progress (10-35)
          setProgress(10 + Math.round(imgProgress * 0.25))
        })

        // Step 3: Generate PDFs client-side (sequential)
        console.log('[ReportGenerator] Step 3: Generating Portuguese PDF...')
        setProgress(40)

        portugueseBlob = await generatePDFClientSide('pt', reportData)
        console.log(`[ReportGenerator] Portuguese PDF: ${(portugueseBlob.size / 1024).toFixed(1)}KB`)

        setProgress(55)
        console.log('[ReportGenerator] Step 4: Generating English PDF...')

        englishBlob = await generatePDFClientSide('en', reportData)
        console.log(`[ReportGenerator] English PDF: ${(englishBlob.size / 1024).toFixed(1)}KB`)
      }

      console.log('[ReportGenerator] PDFs generated successfully')

      // Step 2: Upload to Supabase (70%)
      setProgress(70)

      const portugalFilename = "portuguese.pdf"
      const englishFilename = "english.pdf"

      const [ptUrl, enUrl] = await Promise.all([
        uploadNHomeReportToSupabase(portugueseBlob, portugalFilename, sessionId),
        uploadNHomeReportToSupabase(englishBlob, englishFilename, sessionId),
      ])

      // Step 3: Save to database (100%)
      const photoPackageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/nhome_photos/sessions/${sessionId}/`
      await saveNHomeReportUrls(ptUrl, enUrl, photoPackageUrl)
      setProgress(100)

      setReportUrls({ portuguese: ptUrl, english: enUrl, photoPackage: photoPackageUrl })

      // Auto-download
      downloadBlob(portugueseBlob, portugalFilename)
      downloadBlob(englishBlob, englishFilename)
    } catch (err: any) {
      console.error('NHome report generation error:', err)
      setError(err?.message || 'Professional report generation failed')
    } finally {
      setGenerating(false)
      setProgress(0)
    }
  }

  const saveNHomeReportUrls = async (ptUrl: string, enUrl: string, photoPackage: string) => {
    await fetch('/api/nhome/inspections/save-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        portugueseUrl: ptUrl,
        englishUrl: enUrl,
        photoPackageUrl: photoPackage,
        company: 'NHome Property Setup & Management',
        generated_by: 'NHome Professional Team',
      }),
    })
  }

  const sendProfessionalEmail = async () => {
    if (!clientEmail || !reportUrls.portuguese) return
    try {
      const resp = await fetch('/api/nhome/send-professional-report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          sessionData,
          reportUrls,
          projectName: sessionData.project.name,
          unitNumber: sessionData.apartment.unit_number,
        }),
      })
      if (!resp.ok) throw new Error('Failed to send professional email')
      setEmailSent(true)
    } catch (e: any) {
      setError('Failed to send email: ' + (e?.message || 'unknown_error'))
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getDateString = () => new Date().toISOString().split('T')[0]

  const shareNHomeReport = async (language: 'portuguese' | 'english') => {
    const url = reportUrls[language]
    if (!url) return
    if (navigator.share) {
      await navigator.share({
        title: `NHome Professional Inspection Report - ${sessionData.apartment.unit_number}`,
        text: `Professional property inspection report by NHome Property Management for unit ${sessionData.apartment.unit_number}`,
        url,
      })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Professional report link copied to clipboard!')
    }
  }

  // Allow bypass during testing with ?showReports=1
  const forceReports = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('showReports') === '1'
  const hasResults = !!(sessionData?.results && sessionData.results.length > 0)
  // Allow report generation at any time, even if incomplete
  const canGenerate = hasResults || forceReports

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <NHomeLogo variant="primary" size="md" />
          <div>
            <h3 className="text-xl font-bold text-nhome-primary">Professional Report Generation</h3>
            <p className="text-sm text-gray-600">NHome Quality Documentation System</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-nhome-primary/5 to-nhome-secondary/5 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-nhome-primary">
              {sessionData.project?.name || "NHome Project"}
            </h4>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Apartment:</span> {sessionData.apartment?.unit_number} ({sessionData.apartment?.apartment_type})
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Client:</span>{' '}
              {sessionData.apartment?.client_name && sessionData.apartment?.client_surname
                ? `${sessionData.apartment.client_name} ${sessionData.apartment.client_surname}`
                : sessionData.apartment?.client_name || sessionData.apartment?.client_surname || 'No Client Assigned'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              <strong>Completed:</strong>{' '}
              {sessionData.completed_at
                ? new Date(sessionData.completed_at).toLocaleDateString()
                : 'Incomplete'}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Quality Score:</strong> {sessionData.nhome_quality_score || 'N/A'}/10
            </p>
            <p className="text-sm text-gray-600">
              <strong>Issues Found:</strong>{' '}
              {sessionData.results?.filter((r: any) => r.status !== 'good').length || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Removed restriction: allow report generation anytime */}

      {generating && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-nhome-primary">Generating professional reports...</span>
            <span className="text-sm text-gray-500">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-nhome-primary to-nhome-secondary h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {progress > 0 && progress < 10 && 'Fetching report data...'}
            {progress >= 10 && progress < 35 && 'Processing images for PDF...'}
            {progress >= 35 && progress < 55 && 'Generating Portuguese report...'}
            {progress >= 55 && progress < 70 && 'Generating English report...'}
            {progress >= 70 && progress < 100 && 'Uploading to secure NHome storage...'}
            {progress === 100 && 'Professional reports ready!'}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-nhome-error/10 border border-nhome-error/20 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-nhome-error" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
            </svg>
            <p className="text-nhome-error font-medium">❌ {error}</p>
          </div>
        </div>
      )}

      <button
        onClick={generateNHomeReports}
        disabled={!canGenerate || generating}
        className="w-full bg-gradient-to-r from-nhome-primary to-nhome-secondary hover:from-nhome-primary-dark hover:to-nhome-secondary-dark disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl disabled:transform-none disabled:shadow-none mb-6"
      >
        {generating ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3" />
            Generating Professional Reports...
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
            </svg>
            🏠 Generate NHome Professional Reports
          </div>
        )}
      </button>

      {/* Report preview section temporarily disabled */}

      {reportUrls.portuguese && (
        <>
          {/* <div className="bg-gradient-to-r from-nhome-primary/5 to-nhome-secondary/5 rounded-lg p-4 border border-nhome-primary/10 mb-6">
            <h5 className="font-medium text-nhome-primary mb-3">📧 Send Professional Package to Client</h5>
            <div className="flex space-x-3">
              <input
                type="email"
                placeholder="client@developer.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhome-primary focus:border-transparent"
              />
              <button
                onClick={sendProfessionalEmail}
                disabled={!clientEmail || !reportUrls.portuguese || emailSent}
                className="bg-nhome-primary hover:bg-nhome-primary-dark disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {emailSent ? '✅ Sent' : '📧 Send Professional Package'}
              </button>
            </div>
            {emailSent && (
              <p className="text-sm text-green-600 mt-2">✅ Professional package sent successfully to {clientEmail}</p>
            )}
          </div> */}

          <div className="pt-4 border-t border-gray-200">
            <h5 className="font-medium mb-3">🚀 Quick Actions</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  if (reportUrls.portuguese) {
                    window.open(reportUrls.portuguese, "_blank");
                  } else {
                    alert("Portuguese report not available yet.");
                  }
                }}
                className="bg-nhome-primary hover:bg-nhome-primary-dark text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                🇵🇹 View Portuguese Report
              </button>
              <button
                onClick={() => {
                  if (reportUrls.english) {
                    window.open(reportUrls.english, "_blank");
                  } else {
                    alert("English report not available yet.");
                  }
                }}
                className="bg-nhome-secondary hover:bg-nhome-secondary-dark text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                🇬🇧 View English Report
              </button>
              <button
                onClick={() => {
                  const text = `NHome Professional Inspection Reports:\n\nPortuguese: ${reportUrls.portuguese}\nEnglish: ${reportUrls.english}\nPhotos: ${reportUrls.photoPackage}\n\nProfessional Property Services in the Algarve\nNHome Property Setup & Management`;
                  navigator.clipboard.writeText(text);
                  alert('Professional report package copied!');
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                📋 Copy All Links
              </button>
            </div>
          </div>

        </>
      )}
    </div>
  );
}

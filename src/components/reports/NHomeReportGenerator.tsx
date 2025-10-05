"use client"
import { useState } from 'react'
import { NHomeReportGenerationService } from '@/services/nhomeReportGenerationService'
import { NHomeOneDriveManager } from '@/lib/nhome-onedrive-manager'
import { NHomeLogo } from '@/components/NHomeLogo'

interface NHomeReportGeneratorProps {
  sessionId: string
  sessionData: any
}

export default function NHomeReportGenerator({ sessionId, sessionData }: NHomeReportGeneratorProps) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [reportUrls, setReportUrls] = useState<{ portuguese?: string; english?: string; photoPackage?: string }>({})
  const [error, setError] = useState<string>('')
  const [clientEmail, setClientEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const reportService = new NHomeReportGenerationService()
  const oneDriveManager = new NHomeOneDriveManager()

  const generateNHomeReports = async () => {
    setGenerating(true)
    setProgress(0)
    setError('')

    try {
      // Step 1: Generate professional PDFs (40%)
      setProgress(40)
      const { reports, photoPackage } = await reportService.generateNHomeClientPackage(sessionId)

      // Step 2: Upload to OneDrive with professional organization (70%)
      setProgress(70)
      const folderPath = await createNHomeReportFolder()

      const portugalFilename = `NHome_Relatorio_Profissional_${sessionData.apartment.unit_number}_${getDateString()}.pdf`
      const englishFilename = `NHome_Professional_Report_${sessionData.apartment.unit_number}_${getDateString()}.pdf`

      // Upload both reports to Professional_Reports folder
      const [ptUrl, enUrl] = await Promise.all([
        oneDriveManager.uploadPhoto(
          reports.portuguese,
          portugalFilename,
          `${folderPath}/Professional_Reports`,
          (p) => setProgress(70 + p * 0.15),
        ),
        oneDriveManager.uploadPhoto(
          reports.english,
          englishFilename,
          `${folderPath}/Professional_Reports`,
          (p) => setProgress(85 + p * 0.15),
        ),
      ])

      // Step 3: Save to database and create sharing links (100%)
      await saveNHomeReportUrls(ptUrl, enUrl, photoPackage)
      setProgress(100)

      setReportUrls({ portuguese: ptUrl, english: enUrl, photoPackage })

      // Auto-download for immediate client use
      downloadBlob(reports.portuguese, portugalFilename)
      downloadBlob(reports.english, englishFilename)
    } catch (err: any) {
      console.error('NHome report generation error:', err)
      setError(err?.message || 'Professional report generation failed')
    } finally {
      setGenerating(false)
      setProgress(0)
    }
  }

  const createNHomeReportFolder = async (): Promise<string> => {
    const projectName = sessionData.project.name
    const unitNumber = sessionData.apartment.unit_number
    const date = getDateString()
    return await oneDriveManager.createNHomeFolderStructure(
      sessionData.project.developer_name,
      projectName,
      unitNumber,
      date,
      'initial',
    )
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
  const canGenerateStrict = sessionData.status === 'completed' && hasResults
  const canGenerate = canGenerateStrict || (forceReports && hasResults)

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
            <h4 className="font-semibold text-nhome-primary">{sessionData.project.name}</h4>
            <p className="text-gray-700">
              Unit {sessionData.apartment.unit_number} ({sessionData.apartment.apartment_type})
            </p>
            <p className="text-sm text-gray-500">Developer: {sessionData.project.developer_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              <strong>Completed:</strong> {new Date(sessionData.completed_at).toLocaleDateString()}
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

      {!canGenerateStrict && !forceReports && (
        <div className="bg-nhome-warning/10 border border-nhome-warning/20 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-nhome-warning" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
            </svg>
            <p className="text-nhome-warning font-medium">
              ⚠️ Inspection must be completed before generating professional reports
            </p>
          </div>
        </div>
      )}

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
            {progress < 40 && 'Preparing NHome professional templates...'}
            {progress >= 40 && progress < 70 && 'Generating bilingual reports...'}
            {progress >= 70 && progress < 100 && 'Uploading to professional OneDrive folders...'}
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

      {(reportUrls.portuguese || reportUrls.english) && (
        <div className="space-y-4">
          <h4 className="font-semibold text-nhome-primary flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Professional Reports Generated
          </h4>

          {reportUrls.portuguese && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">PT</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-800">🇵🇹 Relatório Profissional Português</span>
                    <p className="text-sm text-green-600">Para entrega ao promotor e documentação oficial</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => window.open(reportUrls.portuguese, '_blank')}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    📄 View Report
                  </button>
                  <button
                    onClick={() => shareNHomeReport('portuguese')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    🔗 Share
                  </button>
                </div>
              </div>
            </div>
          )}

          {reportUrls.english && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">EN</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">🇬🇧 Professional English Report</span>
                    <p className="text-sm text-blue-600">For international clients and NHome records</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => window.open(reportUrls.english, '_blank')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    📄 View Report
                  </button>
                  <button
                    onClick={() => shareNHomeReport('english')}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    🔗 Share
                  </button>
                </div>
              </div>
            </div>
          )}

          {reportUrls.photoPackage && (
            <div className="bg-nhome-accent/10 border border-nhome-accent/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-nhome-accent rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium text-nhome-accent">📸 Professional Photo Documentation</span>
                    <p className="text-sm text-gray-600">Organized OneDrive folder with comprehensive photos</p>
                  </div>
                </div>
                <button
                  onClick={() => window.open(reportUrls.photoPackage!, '_blank')}
                  className="bg-nhome-accent hover:bg-nhome-accent-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  📁 Open Folder
                </button>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-r from-nhome-primary/5 to-nhome-secondary/5 rounded-lg p-4 border border-nhome-primary/10">
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
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h5 className="font-medium mb-3">🚀 Quick Actions</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={sendProfessionalEmail}
                className="bg-nhome-secondary hover:bg-nhome-secondary-dark text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                📧 Email to Developer
              </button>
              <button
                onClick={() => {
                  const text = `NHome Professional Inspection Reports:\n\nPortuguese: ${reportUrls.portuguese}\nEnglish: ${reportUrls.english}\nPhotos: ${reportUrls.photoPackage}\n\nProfessional Property Services in the Algarve\nNHome Property Setup & Management`
                  navigator.clipboard.writeText(text)
                  alert('Professional report package copied!')
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                📋 Copy All Links
              </button>
              <button
                onClick={() => window.open('https://www.nhomesetup.com', '_blank')}
                className="bg-nhome-accent hover:bg-nhome-accent-dark text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                🌐 NHome Website
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">
          Professional Reports Generated by NHome Property Setup & Management
          <br />
          Serving the Algarve with Excellence Since 2018 • Founded by Natalie O'Kelly
          <br />
          <a
            href="https://www.nhomesetup.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-nhome-primary hover:underline"
          >
            www.nhomesetup.com
          </a>
        </p>
      </div>
    </div>
  )
}

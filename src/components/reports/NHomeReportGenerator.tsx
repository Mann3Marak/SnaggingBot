"use client"
import { useState } from "react"
import { NHomeLogo } from "@/components/NHomeLogo"

interface NHomeReportGeneratorProps {
  sessionId: string
}

export default function NHomeReportGenerator({ sessionId }: NHomeReportGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const handleGenerateReport = async () => {
    setLoading(true)
    setError(null)
    setPdfUrl(null)
    try {
      const res = await fetch(`/api/nhome/reports/${sessionId}/generate`)
      if (!res.ok) throw new Error("Failed to generate report")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (e: any) {
      setError(e.message || "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <NHomeLogo variant="primary" size="md" />
          <div>
            <h3 className="text-xl font-bold text-nhome-primary">Generate Inspection Report</h3>
            <p className="text-sm text-gray-600">Create a professional PDF report for this inspection</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleGenerateReport}
        disabled={loading}
        className="w-full bg-gradient-to-r from-nhome-primary to-nhome-secondary hover:from-nhome-primary-dark hover:to-nhome-secondary-dark text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:transform-none disabled:shadow-none"
      >
        {loading ? "Generating Report..." : "📄 Generate Report PDF"}
      </button>

      {error && (
        <div className="mt-4 text-red-600 text-sm font-medium">
          ❌ {error}
        </div>
      )}

      {pdfUrl && (
        <div className="mt-6 text-center">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-nhome-primary font-semibold hover:underline"
          >
            📥 View or Download Generated Report
          </a>
        </div>
      )}
    </div>
  )
}

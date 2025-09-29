"use client"
import React, { useEffect, useState } from "react"
import { PDFViewer } from "@react-pdf/renderer"
import { NHomeReportGenerationService } from "@/services/nhomeReportGenerationService"

interface NHomeReportPreviewProps {
  sessionId: string
  language?: "pt" | "en"
}

export function NHomeReportPreview({ sessionId, language = "en" }: NHomeReportPreviewProps) {
  const [ReportComponent, setReportComponent] = useState<React.ComponentType | null>(null)

  useEffect(() => {
    const service = new NHomeReportGenerationService()

    async function fetchData() {
      try {
        const data = await (service as any).fetchNHomeInspectionData(sessionId)
        const Report = service.createNHomeReport(data, language)
        setReportComponent(() => Report)
      } catch (err) {
        console.error("Failed to fetch report data", err)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [sessionId, language])

  if (!ReportComponent) {
    return <div className="text-gray-500">Loading live report preview...</div>
  }

  return (
    <div className="w-full h-[80vh] border rounded-lg shadow">
      <PDFViewer width="100%" height="100%">
        <ReportComponent />
      </PDFViewer>
    </div>
  )
}

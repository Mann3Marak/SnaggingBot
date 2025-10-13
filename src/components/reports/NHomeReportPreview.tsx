"use client"
import React, { useEffect, useState } from "react"
import dynamic from "next/dynamic"
const PDFViewer = dynamic(() => import("@react-pdf/renderer").then(mod => mod.PDFViewer), { ssr: false })
import { NHomeReportGenerationService } from "@/services/nhomeReportGenerationService"

interface NHomeReportPreviewProps {
  sessionId: string
  language?: "pt" | "en"
  refreshToken?: number
}

export function NHomeReportPreview({ sessionId, language = "en", refreshToken = 0 }: NHomeReportPreviewProps) {
  const [reportData, setReportData] = useState<any>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const service = new NHomeReportGenerationService()

    async function fetchData() {
      try {
        const data = await service.loadInspectionData(sessionId)
        setReportData(data)
        setVersion(prev => prev + 1)
      } catch (err) {
        console.error("Failed to fetch report data", err)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [sessionId, language, refreshToken])

  if (!reportData) {
    return <div className="text-gray-500">Loading live report preview...</div>
  }

  const service = new NHomeReportGenerationService()
  const Report = service.createNHomeReport(reportData, language)

  return (
    <div className="w-full h-[80vh] border rounded-lg shadow">
      <PDFViewer key={`${version}-${language}`} width="100%" height="100%">
        <Report />
      </PDFViewer>
    </div>
  )
}

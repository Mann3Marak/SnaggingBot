import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Link, Font } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { pt, enGB } from 'date-fns/locale'

interface NHomeInspectionData {
  session: any
  apartment: any
  project: any
  developer: any
  client?: {
    first_name?: string
    last_name?: string
  }
  results: any[]
  photos: any[]
  inspector: any
  company_info: NHomeCompanyInfo
}

interface NHomeCompanyInfo {
  name: string
  founder: string
  location: string
  website: string
  tagline: string
  email: string
  established: string
}

interface NHomeReportLanguage {
  title: string
  company_title: string
  client: string
  property: string
  apartment: string
  date: string
  inspector: string
  summary: string
  defects: string
  recommendations: string
  quality_assessment: string
  page: string
  of: string
}

// Font registration disabled - relative paths don't work in browser context
// Using built-in Helvetica font instead
// Font.register({
//   family: 'Roboto',
//   src: '/fonts/Roboto-Regular.ttf',
// })

const PT: NHomeReportLanguage = {
  title: 'INSPEÇÃO DE LISTA DE PENDÊNCIAS',
  company_title: 'NHome Property Setup & Management',
  client: 'Cliente',
  property: 'Imóvel',
  apartment: 'Fração',
  date: 'Data',
  inspector: 'Inspetor',
  summary: 'RESUMO EXECUTIVO',
  defects: 'ANOMALIAS IDENTIFICADAS',
  recommendations: 'RECOMENDAÇÕES',
  quality_assessment: 'AVALIAÇÃO DE QUALIDADE',
  page: 'Página',
  of: 'de',
}

const EN: NHomeReportLanguage = {
  title: 'SNAG LIST INSPECTION',
  company_title: 'NHome Property Setup & Management',
  client: 'Client',
  property: 'Property',
  apartment: 'Unit',
  date: 'Date',
  inspector: 'Inspector',
  summary: 'EXECUTIVE SUMMARY',
  defects: 'IDENTIFIED ISSUES',
  recommendations: 'RECOMMENDATIONS',
  quality_assessment: 'QUALITY ASSESSMENT',
  page: 'Page',
  of: 'of',
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#d29d54', paddingBottom: 10 },
  title: { fontSize: 20, color: '#8f8552', textAlign: 'center' },
  sub: { fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 },
  cell: { width: '48%', marginBottom: 8 },
  label: { fontSize: 10, color: '#a59a5e' },
  value: { fontSize: 11, color: '#0f172a' },
  h2: { fontSize: 14, color: '#8f8552', marginTop: 18, marginBottom: 8 },
  text: { fontSize: 11, color: '#0f172a', lineHeight: 1.5 },
  item: { marginTop: 8, padding: 8, borderLeftWidth: 3, borderLeftColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  photo: { width: '48%', height: 110, marginTop: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
})

export class NHomeReportGenerationService {
  private companyInfo: NHomeCompanyInfo = {
    name: 'NHome Property Setup & Management',
    founder: "Natalie O'Kelly",
    location: 'Algarve, Portugal',
    website: 'https://www.nhomesetup.com',
    tagline: 'Your Property Setup and Management Partner in the Algarve',
    email: 'info@nhomesetup.com',
    established: '2018',
  }

  private score(results: any[]): number {
    if (results.length === 0) return 10
    const t = results.length
    const good = results.filter((r) => r.status === 'good').length
    const issue = results.filter((r) => r.status === 'issue').length
    const crit = results.filter((r) => r.status === 'critical').length
    const base = (good / t) * 10
    const final = Math.max(1, base - (issue / t) * 2 - (crit / t) * 4)
    return Math.round(final * 10) / 10
  }

  private execSummary(data: NHomeInspectionData, lang: 'pt' | 'en', qs: number): string {
    const apt = data.apartment.apartment_type
    const total = data.results.length
    const issues = data.results.filter((r) => r.status !== 'good').length
    const date = format(new Date(data.session.started_at), 'PPP', { locale: lang === 'pt' ? pt : enGB })
    if (lang === 'pt') {
      return `Vistoria profissional ao ${apt} - Unidade ${data.apartment.unit_number} no projeto ${data.project.name} em ${date}. Foram avaliados ${total} pontos de qualidade, com ${issues} questões identificadas. Pontuação de qualidade NHome: ${qs}/10.`
    }
    return `Professional inspection of ${apt} - Unit ${data.apartment.unit_number} at ${data.project.name} on ${date}. Assessed ${total} quality points, with ${issues} issues identified. NHome quality score: ${qs}/10.`
  }

  private priorityText(p: number, lang: 'pt' | 'en'): string {
    if (lang === 'pt') return p === 3 ? 'Alta' : p === 2 ? 'Média' : p === 1 ? 'Baixa' : 'N/A'
    return p === 3 ? 'High' : p === 2 ? 'Medium' : p === 1 ? 'Low' : 'N/A'
  }

  private translateItem(desc?: string): string {
    if (!desc) return ''
    const dict: Record<string, string> = {
      'Lights': 'Luzes',
      'Ceiling': 'Teto',
      'Walls / wood panels': 'Paredes / painéis de madeira',
      'Door': 'Porta',
      'Floor & skirting': 'Pavimento e rodapés',
      'Window': 'Janela',
      'Kitchen': 'Cozinha',
      'Bathroom': 'Casa de banho',
      'Hall': 'Corredor',
    }
    return dict[desc] || desc
  }

  private async translateNoteWithOpenAI(note?: string): Promise<string> {
    if (!note) return ''
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional translator that translates English inspection notes into natural, fluent Portuguese used in property inspection reports. Only return the translated text.',
            },
            {
              role: 'user',
              content: note,
            },
          ],
        }),
      })

      if (!res.ok) {
        console.error('OpenAI translation failed:', await res.text())
        return note
      }

      const data = await res.json()
      const translated = data.choices?.[0]?.message?.content?.trim()
      return translated || note
    } catch (err) {
      console.error('Translation error:', err)
      return note
    }
  }

  createNHomeReport(data: NHomeInspectionData, language: 'pt' | 'en') {
    const L = language === 'pt' ? PT : EN
    const locale = language === 'pt' ? pt : enGB
    const defects = data.results.filter((r) => r.status === 'issue')
    const critical = data.results.filter((r) => r.status === 'critical')
    const good = data.results.filter((r) => r.status === 'good')
    const qs = this.score(data.results)

    if (language === "pt") {
      const { NHomeReportTemplatePT } = require("@/components/reports/NHomeReportTemplatePT");
      const Report = () => <NHomeReportTemplatePT data={data} />;
      return Report;
    } else {
      const { NHomeReportTemplateEN } = require("@/components/reports/NHomeReportTemplateEN");
      const Report = () => <NHomeReportTemplateEN data={data} />;
      return Report;
    }
  }

  async generateNHomeBilingualReports(sessionId: string): Promise<{ portuguese: Blob; english: Blob }> {
    console.log('[ReportService] generateNHomeBilingualReports started', { sessionId })
    const data = await this.loadInspectionData(sessionId)
    console.log('[ReportService] Data loaded', {
      resultsCount: data.results?.length,
      photosCount: data.photos?.length,
      hasProject: !!data.project,
      hasApartment: !!data.apartment,
    })

    // Use existing Portuguese notes from database (pt_notes)
    const translatedResults = data.results.map((r) => ({
      ...r,
      translated_note: r.pt_notes || r.notes,
    }));

    const translatedData = { ...data, results: translatedResults };

    console.log('[ReportService] Creating Portuguese report template...')
    const PTReport = this.createNHomeReport(translatedData, "pt");
    console.log('[ReportService] Creating English report template...')
    const ENReport = this.createNHomeReport(data, "en");

    console.log('[ReportService] Rendering Portuguese PDF...')
    const portuguese = await this.renderNHomePDF(PTReport);
    console.log('[ReportService] Portuguese PDF complete. Rendering English PDF...')
    const english = await this.renderNHomePDF(ENReport);
    console.log('[ReportService] Both PDFs rendered successfully')

    return { portuguese, english };
  }

  public async loadInspectionData(sessionId: string): Promise<NHomeInspectionData> {
    console.log('[ReportService] loadInspectionData called', { sessionId })
    const url = `/api/nhome/inspections/${sessionId}/report-data?t=${Date.now()}`
    console.log('[ReportService] Fetching:', url)

    const res = await fetch(url, { cache: 'no-store' })
    console.log('[ReportService] Fetch response:', { status: res.status, ok: res.ok })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[ReportService] Fetch failed:', errorText)
      throw new Error('Failed to fetch NHome inspection data')
    }

    const data = (await res.json()) as NHomeInspectionData
    console.log('[ReportService] Data parsed successfully')
    return data
  }

  private async renderNHomePDF(ReportComponent: React.ComponentType): Promise<Blob> {
    console.log('[ReportService] Starting PDF render...')
    const startTime = Date.now()

    try {
      console.log('[ReportService] Importing @react-pdf/renderer...')
      const { pdf } = await import('@react-pdf/renderer')
      console.log('[ReportService] Creating PDF instance...')
      const inst = pdf(<ReportComponent />)
      console.log('[ReportService] Converting to blob (this may take a while)...')
      const blob = await inst.toBlob()
      console.log(`[ReportService] PDF rendered successfully in ${Date.now() - startTime}ms, size: ${blob.size} bytes`)
      return blob
    } catch (error: any) {
      console.error('[ReportService] PDF render failed:', error?.message, error?.stack)
      throw error
    }
  }

  async generateNHomeClientPackage(sessionId: string): Promise<{
    reports: { portuguese: Blob; english: Blob }
    photoPackage: string
    documentationSummary: string
  }> {
    const data = await this.loadInspectionData(sessionId)
    const reports = await this.generateNHomeBilingualReports(sessionId)
    const photoUploadService = new (await import('@/services/nhomePhotoUploadService')).NHomePhotoUploadService()
    const { package_url: photoPackageUrl } = await photoUploadService.shareInspectionWithClient(sessionId, data.session)
    const documentationSummary = `NHome Professional Inspection Summary: ${data.client?.first_name ?? data.project.client_first_name ?? 'Client'} ${data.client?.last_name ?? data.project.client_last_name ?? ''} - ${data.apartment.unit_number}`
    return { reports, photoPackage: photoPackageUrl ?? '', documentationSummary }
  }
}

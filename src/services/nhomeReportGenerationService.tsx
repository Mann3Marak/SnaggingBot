import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { pt, enGB } from 'date-fns/locale'

interface NHomeInspectionData {
  session: any
  apartment: any
  project: any
  developer: any
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

const PT: NHomeReportLanguage = {
  title: 'RELATÓRIO PROFISSIONAL DE VISTORIA',
  company_title: 'NHome Property Setup & Management',
  client: 'Cliente',
  property: 'Propriedade',
  apartment: 'Apartamento',
  date: 'Data',
  inspector: 'Inspetor',
  summary: 'RESUMO EXECUTIVO',
  defects: 'QUESTÕES IDENTIFICADAS',
  recommendations: 'RECOMENDAÇÕES',
  quality_assessment: 'AVALIAÇÃO DE QUALIDADE',
  page: 'Página',
  of: 'de',
}

const EN: NHomeReportLanguage = {
  title: 'PROFESSIONAL PROPERTY INSPECTION REPORT',
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
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#2563EB', paddingBottom: 10 },
  title: { fontSize: 20, color: '#2563EB', textAlign: 'center' },
  sub: { fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 },
  cell: { width: '48%', marginBottom: 8 },
  label: { fontSize: 10, color: '#2563EB' },
  value: { fontSize: 11, color: '#0f172a' },
  h2: { fontSize: 14, color: '#2563EB', marginTop: 18, marginBottom: 8 },
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
      return `Vistoria profissional ao ${apt} - Unidade ${data.apartment.unit_number} no projecto ${data.project.name} em ${date}. Foram avaliados ${total} pontos de qualidade, com ${issues} questões identificadas. Pontuação de qualidade NHome: ${qs}/10.`
    }
    return `Professional inspection of ${apt} - Unit ${data.apartment.unit_number} at ${data.project.name} on ${date}. Assessed ${total} quality points, with ${issues} issues identified. NHome quality score: ${qs}/10.`
  }

  private priorityText(p: number, lang: 'pt' | 'en'): string {
    if (lang === 'pt') return p === 3 ? 'Alta' : p === 2 ? 'Média' : p === 1 ? 'Baixa' : 'N/A'
    return p === 3 ? 'High' : p === 2 ? 'Medium' : p === 1 ? 'Low' : 'N/A'
  }

  createNHomeReport(data: NHomeInspectionData, language: 'pt' | 'en') {
    const L = language === 'pt' ? PT : EN
    const locale = language === 'pt' ? pt : enGB
    const defects = data.results.filter((r) => r.status === 'issue')
    const critical = data.results.filter((r) => r.status === 'critical')
    const good = data.results.filter((r) => r.status === 'good')
    const qs = this.score(data.results)

    const Report = () => (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>{L.title}</Text>
            <Text style={styles.sub}>{L.company_title}</Text>
          </View>

          <View style={styles.grid}>
            <View style={styles.cell}><Text style={styles.label}>{L.client}:</Text><Text style={styles.value}>{data.project.developer_name}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>{L.property}:</Text><Text style={styles.value}>{data.project.name}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>{L.apartment}:</Text><Text style={styles.value}>{data.apartment.apartment_type} • {data.apartment.unit_number}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>{L.date}:</Text><Text style={styles.value}>{format(new Date(data.session.started_at), 'PPP', { locale })}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>{L.inspector}:</Text><Text style={styles.value}>NHome Professional Team</Text></View>
          </View>

          <Text style={styles.h2}>{L.quality_assessment}</Text>
          <Text style={styles.text}>{qs}/10 • {good.length} good • {defects.length + critical.length} issues</Text>

          <Text style={styles.h2}>{L.summary}</Text>
          <Text style={styles.text}>{this.execSummary(data, language, qs)}</Text>

          {critical.length > 0 && (
            <>
              <Text style={styles.h2}>CRITICAL</Text>
              {critical.map((it, i) => {
                const ph = data.photos.filter((p) => p.item_id === it.item_id).slice(0, 2)
                return (
                  <View key={`c-${i}`} style={styles.item}>
                    <Text style={styles.text}>🚨 {i + 1}. {it.checklist_templates?.item_description} ({this.priorityText(it.priority_level, language)})</Text>
                    {ph.length > 0 && (
                      <View style={styles.row}>
                        {ph.map((p: any, j: number) => <Image key={j} style={styles.photo} src={p.onedrive_url} />)}
                      </View>
                    )}
                  </View>
                )
              })}
            </>
          )}

          {defects.length > 0 && (
            <>
              <Text style={styles.h2}>{L.defects}</Text>
              {defects.map((it, i) => {
                const ph = data.photos.filter((p) => p.item_id === it.item_id).slice(0, 2)
                return (
                  <View key={`d-${i}`} style={styles.item}>
                    <Text style={styles.text}>{i + 1}. {it.checklist_templates?.item_description} ({this.priorityText(it.priority_level, language)})</Text>
                    {ph.length > 0 && (
                      <View style={styles.row}>
                        {ph.map((p: any, j: number) => <Image key={j} style={styles.photo} src={p.onedrive_url} />)}
                      </View>
                    )}
                  </View>
                )
              })}
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.text}>{this.companyInfo.name} • {this.companyInfo.email}</Text>
            <Text style={styles.text}>{L.page} 1 {L.of} 1</Text>
          </View>
        </Page>
      </Document>
    )

    return Report
  }

  async generateNHomeBilingualReports(sessionId: string): Promise<{ portuguese: Blob; english: Blob }> {
    const data = await this.fetchNHomeInspectionData(sessionId)
    const PTReport = this.createNHomeReport(data, 'pt')
    const ENReport = this.createNHomeReport(data, 'en')
    const portuguese = await this.renderNHomePDF(PTReport)
    const english = await this.renderNHomePDF(ENReport)
    return { portuguese, english }
  }

  private async fetchNHomeInspectionData(sessionId: string): Promise<NHomeInspectionData> {
    const res = await fetch(`/api/nhome/inspections/${sessionId}/report-data`)
    if (!res.ok) throw new Error('Failed to fetch NHome inspection data')
    return (await res.json()) as NHomeInspectionData
  }

  private async renderNHomePDF(ReportComponent: React.ComponentType): Promise<Blob> {
    const { pdf } = await import('@react-pdf/renderer')
    const inst = pdf(<ReportComponent />)
    return await inst.toBlob()
  }

  async generateNHomeClientPackage(sessionId: string): Promise<{
    reports: { portuguese: Blob; english: Blob }
    photoPackage: string
    documentationSummary: string
  }> {
    const reports = await this.generateNHomeBilingualReports(sessionId)
    const photoUploadService = new (await import('@/services/nhomePhotoUploadService')).NHomePhotoUploadService()
    const photoPackage = await photoUploadService.shareInspectionWithClient(sessionId)
    const data = await this.fetchNHomeInspectionData(sessionId)
    const documentationSummary = `NHome Professional Inspection Summary: ${data.project.name} - ${data.apartment.unit_number}`
    return { reports, photoPackage, documentationSummary }
  }
}

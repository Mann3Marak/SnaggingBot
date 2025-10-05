import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer'
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
  title: 'RELAT??RIO PROFISSIONAL DE INSPE????O',
  company_title: 'NHome Property Setup & Management',
  client: 'Cliente',
  property: 'Im??vel',
  apartment: 'Fra????o',
  date: 'Data',
  inspector: 'Inspetor',
  summary: 'RESUMO EXECUTIVO',
  defects: 'ANOMALIAS IDENTIFICADAS',
  recommendations: 'RECOMENDA????ES',
  quality_assessment: 'AVALIA????O DE QUALIDADE',
  page: 'P??gina',
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
      return `Vistoria profissional ao ${apt} - Unidade ${data.apartment.unit_number} no projecto ${data.project.name} em ${date}. Foram avaliados ${total} pontos de qualidade, com ${issues} quest??es identificadas. Pontua????o de qualidade NHome: ${qs}/10.`
    }
    return `Professional inspection of ${apt} - Unit ${data.apartment.unit_number} at ${data.project.name} on ${date}. Assessed ${total} quality points, with ${issues} issues identified. NHome quality score: ${qs}/10.`
  }

  private priorityText(p: number, lang: 'pt' | 'en'): string {
    if (lang === 'pt') return p === 3 ? 'Alta' : p === 2 ? 'M??dia' : p === 1 ? 'Baixa' : 'N/A'
    return p === 3 ? 'High' : p === 2 ? 'Medium' : p === 1 ? 'Low' : 'N/A'
  }

  private translateItem(desc?: string): string {
    if (!desc) return ''
    const dict: Record<string, string> = {
      'Lights': 'Luzes',
      'Ceiling': 'Teto',
      'Walls / wood panels': 'Paredes / pain??is de madeira',
      'Door': 'Porta',
      'Floor & skirting': 'Pavimento e rodap??s',
      'Window': 'Janela',
      'Kitchen': 'Cozinha',
      'Bathroom': 'Casa de banho',
      'Hall': 'Corredor',
    }
    return dict[desc] || desc
  }

  private translateNote(note?: string): string {
    if (!note) return ''
    const dict: Record<string, string> = {
      'Meets NHome standards': 'Cumpre os padr??es NHome',
      'lights hanging out': 'luzes penduradas',
      'lights hannign out': 'luzes penduradas',
      'door is cracked': 'porta rachada',
    }
    return dict[note] || note
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
            <View style={styles.cell}><Text style={styles.label}>{L.apartment}:</Text><Text style={styles.value}>{data.apartment.apartment_type} ??? {data.apartment.unit_number}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>{L.date}:</Text><Text style={styles.value}>{format(new Date(data.session.started_at), 'PPP', { locale })}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>{L.inspector}:</Text><Text style={styles.value}>NHome Professional Team</Text></View>
          </View>

          <Text style={styles.h2}>{L.quality_assessment}</Text>
          <Text style={styles.text}>{qs}/10 ??? {good.length} good ??? {defects.length + critical.length} issues</Text>

          <Text style={styles.h2}>{L.summary}</Text>
          <Text style={styles.text}>{this.execSummary(data, language, qs)}</Text>

          <Text style={styles.h2}>{language === 'pt' ? 'TODAS AS ??REAS' : 'ALL AREAS'}</Text>
          {Object.entries(
            data.results.reduce((acc: Record<string, any[]>, it: any) => {
              const room = it.checklist_templates?.room_type || "Uncategorized"
              if (!acc[room]) acc[room] = []
              acc[room].push(it)
              return acc
            }, {} as Record<string, any[]>)
          ).map(([room, items], ri) => (
            <View key={`room-${ri}`} style={{ marginBottom: 12 }}>
              <Text style={[styles.h2, { marginTop: 12 }]}>{room}</Text>
              {(items as any[]).map((it, i) => {
                const ph = it.preview_photos?.slice(0, 2) || []
                return (
                  <View key={`all-${ri}-${i}`} style={styles.item}>
                    <Text style={styles.text}>
                      {it.status === 'good' ? '???' : it.status === 'issue' ? '??????' : '????'} {i + 1}. {language === 'pt' ? this.translateItem(it.checklist_templates?.item_description || `Item ${it.item_id}`) : (it.checklist_templates?.item_description || `Item ${it.item_id}`)} ({this.priorityText(it.priority_level, language)})
                    </Text>
                    {ph.length > 0 && (
                      <View style={styles.row}>
                        {ph.map((p: any, j: number) => {
                          const rawUrl = typeof p.url === 'string' ? p.url : ''
                          if (!rawUrl) return null
                          const decodedUrl = decodeURI(rawUrl)
                          const isSharepoint = /sharepoint\.com|onedrive\.live\.com/i.test(rawUrl)
                          if (isSharepoint) {
                            return (
                              <Link key={j} src={rawUrl} style={styles.text}>
                                {decodedUrl}
                              </Link>
                            )
                          }
                          return <Image key={j} style={styles.photo} src={rawUrl} />
                        })}
                      </View>
                    )}
                    {it.notes && (
                      <Text style={styles.text}>
                        {language === 'pt' ? 'Notas' : 'Notes'}: {language === 'pt' ? this.translateNote(it.enhanced_notes || it.notes) : it.notes}
                      </Text>
                    )}
                  </View>
                )
              })}
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.text}>{this.companyInfo.name} ??? {this.companyInfo.email}</Text>
            <Text style={styles.text}>{L.page} 1 {L.of} 1</Text>
          </View>
        </Page>
      </Document>
    )

    return Report
  }

  async generateNHomeBilingualReports(sessionId: string): Promise<{ portuguese: Blob; english: Blob }> {
    const data = await this.loadInspectionData(sessionId)
    const PTReport = this.createNHomeReport(data, 'pt')
    const ENReport = this.createNHomeReport(data, 'en')
    const portuguese = await this.renderNHomePDF(PTReport)
    const english = await this.renderNHomePDF(ENReport)
    return { portuguese, english }
  }

  public async loadInspectionData(sessionId: string): Promise<NHomeInspectionData> {
    const res = await fetch(`/api/nhome/inspections/${sessionId}/report-data?t=${Date.now()}`, { cache: 'no-store' })
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
    const data = await this.loadInspectionData(sessionId)
    const reports = await this.generateNHomeBilingualReports(sessionId)
    const photoUploadService = new (await import('@/services/nhomePhotoUploadService')).NHomePhotoUploadService()
    const photoPackage = await photoUploadService.shareInspectionWithClient(sessionId, data.session)
    const documentationSummary = `NHome Professional Inspection Summary: ${data.project.name} - ${data.apartment.unit_number}`
    return { reports, photoPackage, documentationSummary }
  }
}




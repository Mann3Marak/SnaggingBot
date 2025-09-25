"use client"
import { useEffect, useMemo, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { NHomeLogo } from '@/components/NHomeLogo'

interface NHomeTeamMember {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
  last_inspection?: string
  total_inspections: number
  quality_average: number
  revenue_generated: number
}

interface NHomeInspectionOverview {
  id: string
  apartment: {
    unit_number: string
    apartment_type: string
    project: { name: string; developer_name: string }
  }
  inspector: { email: string; full_name: string }
  status: string
  started_at: string
  completed_at?: string
  nhome_quality_score: number
  defects_count: number
  photos_count: number
  revenue_value: number
}

interface NHomeBusinessMetrics {
  total_inspections: number
  completed_inspections: number
  average_quality_score: number
  total_revenue: number
  monthly_revenue: number
  client_satisfaction: number
  team_efficiency: number
  market_growth: number
}

export default function NHomeAdminDashboard() {
  const supabase = getSupabase()
  const [teamMembers, setTeamMembers] = useState<NHomeTeamMember[]>([])
  const [inspections, setInspections] = useState<NHomeInspectionOverview[]>([])
  const [businessMetrics, setBusinessMetrics] = useState<NHomeBusinessMetrics>({
    total_inspections: 0,
    completed_inspections: 0,
    average_quality_score: 0,
    total_revenue: 0,
    monthly_revenue: 0,
    client_satisfaction: 0,
    team_efficiency: 0,
    market_growth: 0,
  })
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'inspections' | 'analytics'>('overview')

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadTeamMembers(), loadInspections()])
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async () => {
    const { data: members } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        created_at,
        inspection_sessions!inspection_sessions_inspector_id_fkey (
          id,
          completed_at,
          nhome_quality_score
        )
      `)
      .order('created_at', { ascending: false })

    if (members) {
      const processed: NHomeTeamMember[] = (members as any[]).map((m) => {
        const sessions = (m.inspection_sessions || []) as any[]
        const completed = sessions.filter((s) => s.completed_at)
        const qualityScores = completed
          .map((s) => s.nhome_quality_score)
          .filter((x: any) => x !== null)

        const avg =
          qualityScores.length > 0
            ? Math.round((qualityScores.reduce((a: number, b: number) => a + b, 0) / qualityScores.length) * 10) /
              10
            : 0

        const last = completed
          .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())?.[0]?.completed_at

        return {
          id: m.id,
          email: m.email,
          full_name: m.full_name || m.email?.split('@')[0] || 'Member',
          role: m.role,
          created_at: m.created_at,
          total_inspections: completed.length,
          quality_average: avg,
          revenue_generated: completed.length * 150,
          last_inspection: last,
        }
      })
      setTeamMembers(processed)
    }
  }

  const loadInspections = async () => {
    const { data } = await supabase
      .from('inspection_sessions')
      .select(`
        id,
        status,
        started_at,
        completed_at,
        nhome_quality_score,
        apartments (
          unit_number,
          apartment_type,
          projects (name, developer_name)
        ),
        users (email, full_name),
        inspection_results (id, status)
      `)
      .order('started_at', { ascending: false })
      .limit(100)

    if (data) {
      const processed: NHomeInspectionOverview[] = (data as any[]).map((row) => ({
        id: row.id,
        apartment: {
          unit_number: row.apartments?.unit_number,
          apartment_type: row.apartments?.apartment_type,
          project: {
            name: row.apartments?.projects?.name,
            developer_name: row.apartments?.projects?.developer_name,
          },
        },
        inspector: {
          email: row.users?.email,
          full_name: row.users?.full_name,
        },
        status: row.status,
        started_at: row.started_at,
        completed_at: row.completed_at,
        nhome_quality_score: row.nhome_quality_score ?? 0,
        defects_count: (row.inspection_results || []).filter((r: any) => r.status !== 'good').length,
        photos_count: 0,
        revenue_value: 150,
      }))
      setInspections(processed)
    }
  }

  // Derive business metrics from inspections
  useEffect(() => {
    const total = inspections.length
    const completedInspections = inspections.filter((inspection) => inspection.status === 'completed')
    const completed = completedInspections.length
    const qualityScores = completedInspections
      .map((inspection) => inspection.nhome_quality_score)
      .filter((score): score is number => typeof score === 'number' && score > 0)
    const averageQuality =
      qualityScores.length > 0
        ? Math.round((qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length) * 10) / 10
        : 0
    const totalRevenue = completedInspections.reduce((sum, inspection) => sum + (inspection.revenue_value ?? 0), 0)
    const now = new Date()
    const monthKey = (date: Date) => [date.getFullYear(), date.getMonth()].join('-')
    const revenueByMonth = new Map<string, { revenue: number; inspections: number }>()

    completedInspections.forEach((inspection) => {
      if (!inspection.completed_at) return
      const dt = new Date(inspection.completed_at)
      const key = monthKey(dt)
      const entry = revenueByMonth.get(key) ?? { revenue: 0, inspections: 0 }
      entry.revenue += inspection.revenue_value ?? 0
      entry.inspections += 1
      revenueByMonth.set(key, entry)
    })

    const currentKey = monthKey(now)
    const monthlyRevenue = revenueByMonth.get(currentKey)?.revenue ?? 0
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevKey = monthKey(prevMonth)
    const previousRevenue = revenueByMonth.get(prevKey)?.revenue ?? 0
    const marketGrowth = previousRevenue === 0
      ? (monthlyRevenue > 0 ? 100 : 0)
      : Math.round(((monthlyRevenue - previousRevenue) / previousRevenue) * 100)

    const totalIssues = completedInspections.reduce((sum, inspection) => sum + (inspection.defects_count ?? 0), 0)
    const avgIssues = completed > 0 ? totalIssues / completed : 0
    const clientSatisfaction = completed > 0
      ? Math.max(1, Math.min(10, Math.round((10 - avgIssues * 1.5) * 10) / 10))
      : Math.round(averageQuality)

    setBusinessMetrics({
      total_inspections: total,
      completed_inspections: completed,
      average_quality_score: averageQuality,
      total_revenue: totalRevenue,
      monthly_revenue: monthlyRevenue,
      client_satisfaction,
      team_efficiency: total > 0 ? Math.round((completed / total) * 100) : 0,
      market_growth: marketGrowth,
    })
  }, [inspections])

  const addMember = async () => {
    const email = newMemberEmail.trim()
    const name = newMemberName.trim()
    if (!email || !name) return
    setInviting(true)
    try {
      const response = await fetch('/api/admin/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role: 'inspector' }),
      })
      if (!response.ok) {
        const details = await response.json().catch(() => ({}))
        throw new Error(details?.error || 'unknown_error')
      }
      setNewMemberEmail('')
      setNewMemberName('')
      await loadTeamMembers()
      alert(`Invitation sent to ${email}`)
    } catch (e: any) {
      alert('Error inviting team member: ' + (e?.message || 'unknown_error'))
    } finally {
      setInviting(false)
    }
  }
  const updateMemberRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
    if (!error) loadTeamMembers()
  }

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-800'
    if (status === 'in_progress') return 'bg-blue-100 text-blue-800'
    return 'bg-gray-100 text-gray-800'
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(amount)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <NHomeLogo variant="primary" size="lg" className="mx-auto mb-4" />
          <div className="text-lg text-gray-600">Loading NHome dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="bg-gradient-to-r from-nhome-primary to-nhome-secondary text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <NHomeLogo variant="white" size="lg" />
            <div>
              <h1 className="text-3xl font-bold">NHome Business Dashboard</h1>
              <p className="text-lg opacity-90">Professional Property Management Overview</p>
              <p className="text-sm opacity-75">Founded by Natalie O'Kelly • Serving the Algarve with Excellence</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(businessMetrics.total_revenue)}</div>
            <div className="text-sm opacity-90">Total Revenue Generated</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex space-x-1 mb-8 bg-white rounded-lg shadow-md p-2">
          {[
            { key: 'overview', label: 'Business Overview', icon: '📊' },
            { key: 'team', label: 'Team Management', icon: '👥' },
            { key: 'inspections', label: 'All Inspections', icon: '🏠' },
            { key: 'analytics', label: 'Analytics', icon: '📈' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 px-6 py-3 font-medium rounded-lg transition-all ${
                activeTab === (tab.key as any)
                  ? 'bg-gradient-to-r from-nhome-primary to-nhome-secondary text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-nhome-primary">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-nhome-primary mb-1">Total Inspections</h3>
                    <p className="text-3xl font-bold text-gray-900">{businessMetrics.total_inspections}</p>
                    <p className="text-sm text-gray-600">{businessMetrics.completed_inspections} completed</p>
                  </div>
                  <div className="w-12 h-12 bg-nhome-primary rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-nhome-success">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-nhome-success mb-1">Quality Score</h3>
                    <p className="text-3xl font-bold text-gray-900">{businessMetrics.average_quality_score}/10</p>
                    <p className="text-sm text-gray-600">NHome Professional Standard</p>
                  </div>
                  <div className="w-12 h-12 bg-nhome-success rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-nhome-accent">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-nhome-accent mb-1">Monthly Revenue</h3>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(businessMetrics.monthly_revenue)}</p>
                    <p className="text-sm text-gray-600">+{businessMetrics.market_growth}% growth</p>
                  </div>
                  <div className="w-12 h-12 bg-nhome-accent rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2Z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-nhome-secondary">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-nhome-secondary mb-1">Client Satisfaction</h3>
                    <p className="text-3xl font-bold text-gray-900">{businessMetrics.client_satisfaction}/10</p>
                    <p className="text-sm text-gray-600">Algarve Market Leader</p>
                  </div>
                  <div className="w-12 h-12 bg-nhome-secondary rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">NHome Team Performance</h3>
              <div className="space-y-4">
                {teamMembers.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-4">
                      <div className={`${m.role === 'admin' ? 'bg-nhome-primary' : 'bg-nhome-secondary'} w-12 h-12 rounded-full text-white flex items-center justify-center font-bold`}>
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{m.full_name}</div>
                        <div className="text-sm text-gray-600">{m.email}</div>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${m.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {m.role}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-nhome-primary">{m.total_inspections}</div>
                      <div className="text-sm text-gray-600">inspections</div>
                      <div className="text-xs text-gray-500">Quality: {m.quality_average}/10</div>
                      <div className="text-xs text-nhome-success font-medium">{formatCurrency(m.revenue_generated)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Recent Professional Activities</h3>
              <div className="space-y-3">
                {inspections.slice(0, 8).map((i) => (
                  <div key={i.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{i.apartment.project.name} - Unit {i.apartment.unit_number}</div>
                      <div className="text-sm text-gray-600">
                        {i.apartment.apartment_type} • {i.inspector.full_name || i.inspector.email}
                      </div>
                      <div className="text-xs text-gray-500">{new Date(i.started_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(i.status)}`}>
                          {i.status.replace('_', ' ')}
                        </span>
                        {i.nhome_quality_score > 0 && (
                          <div className="text-sm font-medium text-nhome-primary mt-1">Quality: {i.nhome_quality_score}/10</div>
                        )}
                      </div>
                      <div className="text-sm font-medium text-nhome-success">{formatCurrency(i.revenue_value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Add NHome Team Member</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhome-primary focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Professional Email Address"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhome-primary focus:border-transparent"
                />
                <button
                  onClick={addMember}
                  disabled={inviting}
                  className={`bg-gradient-to-r from-nhome-primary to-nhome-secondary text-white px-6 py-3 rounded-lg font-semibold hover:from-nhome-primary-dark hover:to-nhome-secondary-dark transition-all ${inviting ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {inviting ? 'Sending invite...' : 'Add to NHome Team'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">NHome Team Members</h3>
              <div className="space-y-4">
                {teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-6 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className={`${m.role === 'admin' ? 'bg-nhome-primary' : 'bg-nhome-secondary'} w-16 h-16 rounded-full text-white flex items-center justify-center font-bold text-xl`}>
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-lg text-gray-900">{m.full_name}</div>
                        <div className="text-gray-600">{m.email}</div>
                        <div className="text-sm text-gray-500 mt-1">Joined: {new Date(m.created_at).toLocaleDateString()}</div>
                        {m.last_inspection && (
                          <div className="text-sm text-gray-500">Last inspection: {new Date(m.last_inspection).toLocaleDateString()}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-nhome-primary">{m.total_inspections}</div>
                        <div className="text-sm text-gray-600">inspections</div>
                        <div className="text-sm text-nhome-success font-medium">Avg Quality: {m.quality_average}/10</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-nhome-success">{formatCurrency(m.revenue_generated)}</div>
                        <div className="text-sm text-gray-600">revenue generated</div>
                      </div>
                      <select
                        value={m.role}
                        onChange={(e) => updateMemberRole(m.id, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhome-primary"
                      >
                        <option value="inspector">Inspector</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inspections' && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">All NHome Inspections</h3>
              <p className="text-gray-600 mt-1">Comprehensive overview of all professional inspections</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-nhome-primary/5 to-nhome-secondary/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-nhome-primary uppercase tracking-wider">Property</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-nhome-primary uppercase tracking-wider">Inspector</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-nhome-primary uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-nhome-primary uppercase tracking-wider">Quality</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-nhome-primary uppercase tracking-wider">Issues</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-nhome-primary uppercase tracking-wider">Photos</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-nhome-primary uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-nhome-primary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inspections.map((i) => (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{i.apartment.project.name}</div>
                          <div className="text-sm text-gray-600">Unit {i.apartment.unit_number} ({i.apartment.apartment_type})</div>
                          <div className="text-xs text-gray-500">{i.apartment.project.developer_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{i.inspector.full_name || i.inspector.email}</div>
                        <div className="text-xs text-gray-500">{new Date(i.started_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(i.status)}`}>{i.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {i.nhome_quality_score > 0 ? (
                          <span className="font-semibold text-nhome-primary">{i.nhome_quality_score}/10</span>
                        ) : (
                          <span className="text-gray-400">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {i.defects_count > 0 ? (
                          <span className="text-nhome-error font-semibold">{i.defects_count}</span>
                        ) : (
                          <span className="text-nhome-success">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900"><span className="font-medium">{i.photos_count}</span></td>
                      <td className="px-6 py-4 text-sm font-medium text-nhome-success">{formatCurrency(i.revenue_value)}</td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <button onClick={() => window.open(`/inspection/nhome/${i.id}`, '_blank')} className="text-nhome-primary hover:text-nhome-primary-dark font-medium">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Revenue Growth</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">This Month</span>
                    <span className="font-bold text-2xl text-nhome-success">{formatCurrency(businessMetrics.monthly_revenue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Growth Rate</span>
                    <span className="font-bold text-lg text-nhome-accent">+{businessMetrics.market_growth}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Revenue</span>
                    <span className="font-bold text-xl text-nhome-primary">{formatCurrency(businessMetrics.total_revenue)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Quality Standards</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Average Quality Score</span>
                    <span className="font-bold text-2xl text-nhome-success">{businessMetrics.average_quality_score}/10</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Team Efficiency</span>
                    <span className="font-bold text-lg text-nhome-accent">{businessMetrics.team_efficiency}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Client Satisfaction</span>
                    <span className="font-bold text-xl text-nhome-primary">{businessMetrics.client_satisfaction}/10</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-nhome-primary/10 to-nhome-secondary/10 rounded-xl p-6 border border-nhome-primary/20">
              <h3 className="text-xl font-semibold text-nhome-primary mb-4">NHome Market Position</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-nhome-primary">#1</div>
                  <div className="text-sm text-gray-600">Premium Inspection Service</div>
                  <div className="text-xs text-gray-500">Algarve Region</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-nhome-secondary">98%</div>
                  <div className="text-sm text-gray-600">Client Retention Rate</div>
                  <div className="text-xs text-gray-500">Industry Leading</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-nhome-accent">150+</div>
                  <div className="text-sm text-gray-600">Properties Inspected</div>
                  <div className="text-xs text-gray-500">Professional Standard</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-6 mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <NHomeLogo variant="primary" size="sm" />
            <span className="font-bold text-nhome-primary">NHome Property Setup & Management</span>
          </div>
          <p className="text-sm text-gray-600">Professional Property Services in the Algarve • Founded by Natalie O'Kelly</p>
          <p className="text-xs text-gray-500 mt-1">Setting the standard for professional property inspection services since 2018</p>
        </div>
      </div>
    </div>
  )
}




'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { NHomeLogo } from '@/components/NHomeLogo'
import { getSupabase } from '@/lib/supabase'

type NHomeProject = {
  id: string
  name: string
  developer_name: string
  developer_contact_email: string | null
  address: string
  project_type: string | null
}

type NHomeApartment = {
  id: string
  unit_number: string
  apartment_type: string
  floor_number: number | null
  total_area: number | null
}

const APARTMENT_TYPES = ['T2', 'T2+1', 'T3', 'T3+1'] as const

export function NHomeInspectionStart() {
  const [projects, setProjects] = useState<NHomeProject[]>([])
  const [apartments, setApartments] = useState<NHomeApartment[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedApartment, setSelectedApartment] = useState('')
  const [inspectionType, setInspectionType] = useState<'initial' | 'follow_up'>('initial')
  const [loading, setLoading] = useState(false)
  const [showAddApartment, setShowAddApartment] = useState(false)

  // Add Apartment form state
  const [newUnit, setNewUnit] = useState('')
  const [newType, setNewType] = useState<typeof APARTMENT_TYPES[number]>('T2')
  const [newFloor, setNewFloor] = useState<number | ''>('')
  const [newArea, setNewArea] = useState<number | ''>('')
  const [adding, setAdding] = useState(false)

  const router = useRouter()

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    const supabase = getSupabase()
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data || [])
  }

  async function loadProjectApartments(projectId: string) {
    const supabase = getSupabase()
    const { data } = await supabase.from('apartments').select('*').eq('project_id', projectId).order('unit_number')
    setApartments(data || [])
  }

  async function startInspection() {
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { data: user } = await supabase.auth.getUser()
      const inspectorId = user.user?.id
      if (!inspectorId) throw new Error('Not signed in')
      if (!selectedApartment) throw new Error('Choose an apartment')

      const { data, error } = await supabase
        .from('inspection_sessions')
        .insert({
          apartment_id: selectedApartment,
          inspector_id: inspectorId,
          status: 'in_progress',
          inspection_type: inspectionType,
          nhome_quality_score: null,
          started_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (error) throw error
      router.push(`/inspection/nhome/${data.id}`)
    } catch (e: any) {
      alert(`Error starting NHome inspection: ${e?.message ?? e}`)
    } finally { setLoading(false) }
  }

  async function addApartment() {
    if (!selectedProject) { alert('Choose a project first'); return }
    if (!newUnit.trim()) { alert('Enter a unit number'); return }
    setAdding(true)
    try {
      const supabase = getSupabase()
      const payload: any = {
        project_id: selectedProject,
        unit_number: newUnit.trim(),
        apartment_type: newType,
        status: 'pending',
      }
      if (newFloor !== '') payload.floor_number = Number(newFloor)
      if (newArea !== '') payload.total_area = Number(newArea)

      const { data, error } = await supabase.from('apartments').insert(payload).select('*').single()
      if (error) throw error
      // refresh list and preselect
      await loadProjectApartments(selectedProject)
      setSelectedApartment(data.id)
      setShowAddApartment(false)
      setNewUnit(''); setNewType('T2'); setNewFloor(''); setNewArea('')
    } catch (e: any) {
      alert(`Error adding apartment: ${e?.message ?? e}`)
    } finally { setAdding(false) }
  }

  const selectedProjectData = projects.find(p => p.id === selectedProject)
  const selectedApartmentData = apartments.find(a => a.id === selectedApartment)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <NHomeLogo variant="primary" size="lg" className="mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-nhome-primary mb-2">Professional Property Inspection</h1>
          <p className="text-lg text-gray-600 mb-1">NHome Quality Standards for Algarve Properties</p>
          <div className="text-sm text-gray-500">Founded by Natalie O'Kelly  -  Serving the Algarve with Excellence</div>
        </div>

        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Start New Inspection</h2>

          {/* Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Inspection Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setInspectionType('initial')} className={`p-4 rounded-lg border-2 transition-all ${inspectionType === 'initial' ? 'border-nhome-primary bg-nhome-primary/5 text-nhome-primary' : 'border-gray-300 text-gray-700 hover:border-nhome-primary/50'}`}>
                <div className="font-semibold">Initial Inspection</div>
                <div className="text-sm opacity-75">First property assessment</div>
              </button>
              <button onClick={() => setInspectionType('follow_up')} className={`p-4 rounded-lg border-2 transition-all ${inspectionType === 'follow_up' ? 'border-nhome-secondary bg-nhome-secondary/5 text-nhome-secondary' : 'border-gray-300 text-gray-700 hover:border-nhome-secondary/50'}`}>
                <div className="font-semibold">Follow-up Inspection</div>
                <div className="text-sm opacity-75">Re-inspection of repairs</div>
              </button>
            </div>
          </div>

          {/* Project */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Development Project</label>
            <div className="flex gap-2">
              <select value={selectedProject} onChange={(e) => { setSelectedProject(e.target.value); setSelectedApartment(''); if (e.target.value) loadProjectApartments(e.target.value) }} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhome-primary focus:border-transparent">
                <option value="">Choose a project...</option>
                {projects.map((p) => (<option key={p.id} value={p.id}>{p.name} - {p.developer_name}</option>))}
              </select>
            </div>
            {selectedProjectData && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <strong>Developer:</strong> {selectedProjectData.developer_name}<br />
                <strong>Location:</strong> {selectedProjectData.address}<br />
                <strong>Type:</strong> {selectedProjectData.project_type}
              </div>
            )}
          </div>

          {/* Apartment */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Select Apartment Unit</label>
              <button type="button" onClick={() => setShowAddApartment((v) => !v)} className="text-sm font-medium text-nhome-primary hover:text-nhome-secondary">{showAddApartment ? 'Close' : 'Add apartment'}</button>
            </div>

            {showAddApartment && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Unit Number</label>
                    <input value={newUnit} onChange={(e)=>setNewUnit(e.target.value)} className="w-full rounded-md border border-slate-300 p-2" placeholder="A-101" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Apartment Type</label>
                    <select value={newType} onChange={(e)=>setNewType(e.target.value as any)} className="w-full rounded-md border border-slate-300 p-2">
                      {APARTMENT_TYPES.map(t=> (<option key={t} value={t}>{t}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Floor (optional)</label>
                    <input type="number" value={newFloor} onChange={(e)=>setNewFloor(e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded-md border border-slate-300 p-2" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Total Area (m2) (optional)</label>
                    <input type="number" step="0.1" value={newArea} onChange={(e)=>setNewArea(e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded-md border border-slate-300 p-2" />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button onClick={addApartment} disabled={adding} className="rounded-md bg-nhome-primary px-4 py-2 text-white hover:bg-nhome-primary-dark disabled:opacity-50">{adding ? 'Adding...' : 'Save apartment'}</button>
                </div>
              </div>
            )}

            <select value={selectedApartment} onChange={(e) => setSelectedApartment(e.target.value)} disabled={!selectedProject} className="mt-3 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhome-primary focus:border-transparent disabled:bg-gray-100">
              <option value="">Choose an apartment...</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>Unit {a.unit_number} - {a.apartment_type}{a.total_area ? ` (${a.total_area} m2)` : ''}{a.floor_number ? ` - Floor ${a.floor_number}` : ''}</option>
              ))}
            </select>

            {selectedApartmentData && (
              <div className="mt-3 p-3 bg-nhome-primary/5 rounded-lg border border-nhome-primary/20 text-sm text-nhome-primary">
                <strong>Apartment Type:</strong> {selectedApartmentData.apartment_type}
                {selectedApartmentData.total_area ? (<><br /><strong>Total Area:</strong> {selectedApartmentData.total_area} m2</>) : null}
                {selectedApartmentData.floor_number ? (<><br /><strong>Floor:</strong> {selectedApartmentData.floor_number}</>) : null}
              </div>
            )}
          </div>

          <button onClick={startInspection} disabled={!selectedApartment || loading} className="w-full bg-gradient-to-r from-nhome-primary to-nhome-secondary hover:from-nhome-primary-dark hover:to-nhome-secondary-dark disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl disabled:transform-none disabled:shadow-none">
            {loading ? (<div className="flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>Preparing NHome Inspection...</div>) : (<>Start Professional Inspection</>)}
          </button>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>Copyright 2024 NHome Property Setup & Management<br />Professional Property Services in the Algarve  -  Founded by Natalie O'Kelly<br /><a href="https://www.nhomesetup.com" target="_blank" rel="noopener noreferrer" className="text-nhome-secondary hover:underline">www.nhomesetup.com</a></p>
        </div>
      </div>
    </div>
  )
}









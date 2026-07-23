'use client'
import { useEffect, useMemo, useState } from 'react'
import { PlusIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { useNHomeOwners } from '@/hooks/useNHomeOwners'
import { useApartmentOptions } from '@/hooks/useNHomeBookings'
import OwnerForm from '@/components/owners/OwnerForm'
import { ownerFullName, type Owner, type OwnerApartment } from '@/lib/owners'
import { apartmentLabel } from '@/lib/bookings'

export default function OwnersPage() {
  const {
    owners,
    loading,
    error,
    createOwner,
    updateOwner,
    deleteOwner,
    assignApartment,
    createApartmentForOwner,
  } = useNHomeOwners()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Owner | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (o: Owner) => {
    setEditing(o)
    setFormOpen(true)
  }
  const handleSubmit = async (payload: Record<string, unknown>) => {
    if (payload.id) await updateOwner(payload)
    else await createOwner(payload)
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-nhome-foreground">Owners</h1>
          <p className="mt-1 text-slate-600">
            Client / owner records and the apartments they own.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-nhome-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-nhome-secondary"
        >
          <PlusIcon className="h-4 w-4" /> New owner
        </button>
      </header>

      <section className="mt-6 space-y-3">
        {loading && <p className="text-sm text-slate-500">Loading owners…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && owners.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-600">No owners yet. Add your first one.</p>
          </div>
        )}
        {owners.map((o) => (
          <OwnerCard
            key={o.id}
            owner={o}
            onEdit={openEdit}
            onDelete={deleteOwner}
            onAssign={assignApartment}
            onCreateApartment={createApartmentForOwner}
          />
        ))}
      </section>

      <OwnerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
      />
    </main>
  )
}

const APARTMENT_TYPES = ['T2', 'T2+1', 'T3', 'T3+1']

function OwnerCard({
  owner,
  onEdit,
  onDelete,
  onAssign,
  onCreateApartment,
}: {
  owner: Owner
  onEdit: (o: Owner) => void
  onDelete: (id: string) => Promise<void>
  onAssign: (apartmentId: string, ownerId: string | null) => Promise<void>
  onCreateApartment: (payload: Record<string, unknown>) => Promise<unknown>
}) {
  const [expanded, setExpanded] = useState(false)
  const { apartments } = useApartmentOptions()
  const [assignId, setAssignId] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'link' | 'create'>('link')
  const [projects, setProjects] = useState<any[]>([])
  const [newApt, setNewApt] = useState({
    unit_number: '',
    apartment_type: 'T2',
    building_number: '',
    project_id: '',
  })
  const [createMsg, setCreateMsg] = useState('')

  // Load projects lazily (optional link when creating a new apartment).
  useEffect(() => {
    if (!expanded || mode !== 'create' || projects.length) return
    fetch('/api/nhome/projects/list', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setProjects(d?.projects ?? []))
      .catch((err) => console.error('Error loading projects:', err))
  }, [expanded, mode, projects.length])

  const owned = owner.apartments ?? []
  const ownedIds = useMemo(() => new Set(owned.map((a) => a.id)), [owned])
  const assignable = useMemo(
    () => apartments.filter((a) => !ownedIds.has(a.id)),
    [apartments, ownedIds]
  )

  const attach = async () => {
    if (!assignId) return
    setBusy(true)
    try {
      await onAssign(assignId, owner.id)
      setAssignId('')
    } finally {
      setBusy(false)
    }
  }
  const detach = async (apartmentId: string) => {
    setBusy(true)
    try {
      await onAssign(apartmentId, null)
    } finally {
      setBusy(false)
    }
  }
  const createApt = async () => {
    if (!newApt.unit_number.trim()) {
      setCreateMsg('Unit number is required')
      return
    }
    setBusy(true)
    setCreateMsg('')
    try {
      await onCreateApartment({ ...newApt, owner_id: owner.id })
      setNewApt({ unit_number: '', apartment_type: 'T2', building_number: '', project_id: '' })
    } catch (err: any) {
      setCreateMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-nhome-primary">{ownerFullName(owner)}</h3>
          <p className="text-xs text-slate-500">Tax no. {owner.tax_number}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {owner.email && <span>✉ {owner.email}</span>}
            {owner.phone && <span>☎ {owner.phone}</span>}
            {owner.nationality && <span>🌍 {owner.nationality}</span>}
            {owner.preferred_language && <span>🗣 {owner.preferred_language}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(owner)}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-nhome-primary hover:text-nhome-primary"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this owner? Their apartments stay but become unassigned.'))
                onDelete(owner.id)
            }}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-red-400 hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-nhome-primary"
      >
        {expanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        {owned.length} apartment{owned.length === 1 ? '' : 's'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <ul className="space-y-1">
            {owned.length === 0 && (
              <li className="text-xs text-slate-400">No apartments linked yet.</li>
            )}
            {owned.map((a: OwnerApartment) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg bg-nhome-background/50 px-3 py-1.5 text-sm"
              >
                <span className="text-slate-700">
                  {apartmentLabel(a as any)}
                  {a.apartment_type ? ` · ${a.apartment_type}` : ''}
                  {a.projects?.name ? ` — ${a.projects.name}` : ''}
                </span>
                <button
                  onClick={() => detach(a.id)}
                  disabled={busy}
                  className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          {/* Mode toggle: link an existing apartment, or create a brand-new one */}
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setMode('link')}
              className={`rounded-lg px-2 py-1 font-medium transition ${
                mode === 'link'
                  ? 'bg-nhome-primary text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Link existing
            </button>
            <button
              onClick={() => setMode('create')}
              className={`rounded-lg px-2 py-1 font-medium transition ${
                mode === 'create'
                  ? 'bg-nhome-primary text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Create new
            </button>
          </div>

          {mode === 'link' ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={assignId}
                onChange={(e) => setAssignId(e.target.value)}
                className="rounded-lg border p-2 text-sm"
              >
                <option value="">Add an existing apartment…</option>
                {assignable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {apartmentLabel(a as any)}
                    {a.apartment_type ? ` · ${a.apartment_type}` : ''}
                    {a.projects?.name ? ` — ${a.projects.name}` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={attach}
                disabled={!assignId || busy}
                className="rounded-lg bg-nhome-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-nhome-secondary disabled:opacity-50"
              >
                Link
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-nhome-background/40 p-3">
              <p className="text-xs text-slate-500">
                For an apartment that wasn&apos;t snagged. Project is optional.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-lg border p-2 text-sm"
                  placeholder="Unit / apartment no."
                  value={newApt.unit_number}
                  onChange={(e) => setNewApt({ ...newApt, unit_number: e.target.value })}
                />
                <select
                  className="rounded-lg border p-2 text-sm"
                  value={newApt.apartment_type}
                  onChange={(e) => setNewApt({ ...newApt, apartment_type: e.target.value })}
                >
                  {APARTMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border p-2 text-sm"
                  placeholder="Building no. (optional)"
                  value={newApt.building_number}
                  onChange={(e) => setNewApt({ ...newApt, building_number: e.target.value })}
                />
                <select
                  className="rounded-lg border p-2 text-sm"
                  value={newApt.project_id}
                  onChange={(e) => setNewApt({ ...newApt, project_id: e.target.value })}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={createApt}
                disabled={busy}
                className="rounded-lg bg-nhome-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-nhome-secondary disabled:opacity-50"
              >
                Create &amp; link apartment
              </button>
              {createMsg && <p className="text-xs text-red-600">{createMsg}</p>}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

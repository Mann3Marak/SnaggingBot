'use client'
import { useEffect, useState } from 'react'
import { LANGUAGE_OPTIONS, type Owner } from '@/lib/owners'

interface OwnerFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>
  initial?: Owner | null
}

const empty = {
  first_name: '',
  surname: '',
  tax_number: '',
  email: '',
  phone: '',
  address: '',
  nationality: '',
  preferred_language: '',
  secondary_contact_name: '',
  secondary_contact_phone: '',
  notes: '',
}

export default function OwnerForm({ open, onClose, onSubmit, initial }: OwnerFormProps) {
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const isEdit = Boolean(initial?.id)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        first_name: initial.first_name ?? '',
        surname: initial.surname ?? '',
        tax_number: initial.tax_number ?? '',
        email: initial.email ?? '',
        phone: initial.phone ?? '',
        address: initial.address ?? '',
        nationality: initial.nationality ?? '',
        preferred_language: initial.preferred_language ?? '',
        secondary_contact_name: initial.secondary_contact_name ?? '',
        secondary_contact_phone: initial.secondary_contact_phone ?? '',
        notes: initial.notes ?? '',
      })
    } else {
      setForm(empty)
    }
    setMessage('')
  }, [open, initial])

  if (!open) return null

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tax_number.trim()) {
      setMessage('❌ Tax number is required')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const payload: Record<string, unknown> = { ...form }
      if (isEdit) payload.id = initial!.id
      await onSubmit(payload)
      onClose()
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const input = 'border rounded-lg p-2 w-full text-sm'
  const label = 'block text-xs font-medium text-slate-600 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-40 p-4">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-nhome-primary">
          {isEdit ? 'Edit owner' : 'New owner'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>First name</label>
              <input className={input} value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
            </div>
            <div>
              <label className={label}>Surname</label>
              <input className={input} value={form.surname} onChange={(e) => set('surname', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={label}>
              Tax number <span className="text-nhome-error">*</span>
            </label>
            <input
              className={input}
              value={form.tax_number}
              onChange={(e) => set('tax_number', e.target.value)}
              required
              placeholder="e.g. NIF / VAT number"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Email</label>
              <input type="email" className={input} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input className={input} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={label}>Address</label>
            <input className={input} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Nationality</label>
              <input className={input} value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
            </div>
            <div>
              <label className={label}>Preferred language</label>
              <select
                className={input}
                value={form.preferred_language}
                onChange={(e) => set('preferred_language', e.target.value)}
              >
                <option value="">Select…</option>
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-500">Secondary contact</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Name</label>
                <input
                  className={input}
                  value={form.secondary_contact_name}
                  onChange={(e) => set('secondary_contact_name', e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Phone</label>
                <input
                  className={input}
                  value={form.secondary_contact_phone}
                  onChange={(e) => set('secondary_contact_phone', e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <div>
            <label className={label}>Notes</label>
            <textarea className={input} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-nhome-primary py-2 text-sm font-semibold text-white transition hover:bg-nhome-secondary disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create owner'}
          </button>
        </form>

        {message && <p className="mt-3 text-center text-sm text-slate-700">{message}</p>}

        <button onClick={onClose} className="mt-3 w-full text-sm text-slate-500 hover:text-nhome-primary">
          Close
        </button>
      </div>
    </div>
  )
}

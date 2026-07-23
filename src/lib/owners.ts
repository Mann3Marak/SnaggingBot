// Shared owner (client) domain types + helpers.

export interface Owner {
  id: string
  company_id: string | null
  first_name: string | null
  surname: string | null
  tax_number: string
  email: string | null
  phone: string | null
  address: string | null
  nationality: string | null
  preferred_language: string | null
  secondary_contact_name: string | null
  secondary_contact_phone: string | null
  notes: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // Optionally hydrated by the API:
  apartments?: OwnerApartment[]
}

export interface OwnerApartment {
  id: string
  unit_number: string | null
  apartment_type: string | null
  building_number: string | null
  project_id: string | null
  projects?: { id: string; name: string } | null
}

export const LANGUAGE_OPTIONS = [
  'English',
  'Portuguese',
  'French',
  'German',
  'Spanish',
  'Dutch',
  'Other',
]

export function ownerFullName(owner?: Partial<Owner> | null): string {
  if (!owner) return 'Unknown owner'
  const name = [owner.first_name, owner.surname].filter(Boolean).join(' ').trim()
  return name || 'Unnamed owner'
}

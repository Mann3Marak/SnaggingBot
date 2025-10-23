export interface NHomePhotoMetadata {
  inspector: string
  company: string
  property: string
  unit: string
  room: string
  item: string
  timestamp: string
  location: string
  quality_standards: string
  sessionId?: string // added to scope photos per inspection session
}

export interface NHomePhoto {
  id: string
  blob?: Blob // made optional to allow persistence of Supabase-only records
  url: string
  metadata: NHomePhotoMetadata
  itemId?: string
  timestamp: number
  uploaded: boolean
  storage_url?: string
  supabase_url?: string
}

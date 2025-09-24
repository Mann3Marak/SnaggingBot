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
}

export interface NHomePhoto {
  id: string
  blob: Blob
  url: string
  metadata: NHomePhotoMetadata
  itemId?: string
  timestamp: number
  uploaded: boolean
  onedrive_url?: string
}


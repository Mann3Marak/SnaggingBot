"use client"
import { useEffect, useMemo, useState } from 'react'
import type { NHomePhoto, NHomePhotoMetadata } from '@/types/nhome-photo'

const DB_NAME = 'nhome-photos'
const STORE = 'photos'

type RemotePhotoRecord = {
  id: string
  session_id: string
  item_id: string | null
  file_name: string | null
  supabase_url: string | null
  inspector_name: string | null
  metadata?: NHomePhotoMetadata | null
  file_size?: number | null
  image_dimensions?: any
  storage_path?: string | null
  signed_url?: string | null
  created_at?: string | null
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGetAll<T>(): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

async function idbPut<T extends { id: string }>(value: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.put(value)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

const DEFAULT_METADATA: Pick<
  NHomePhotoMetadata,
  'company' | 'location' | 'quality_standards' | 'unit' | 'property' | 'room'
> = {
  company: 'NHome Property Setup & Management',
  property: 'NHome Property',
  unit: 'Unit',
  room: 'Inspection Item',
  location: 'Algarve, Portugal',
  quality_standards: 'NHome Professional Standards',
}

const fileNameFromMetadata = (metadata: NHomePhotoMetadata): string => {
  const timestamp = new Date(metadata.timestamp).toISOString().replace(/[:.]/g, '-')
  const cleanProperty = metadata.property.replace(/[^a-zA-Z0-9]/g, '_')
  const cleanUnit = metadata.unit.replace(/[^a-zA-Z0-9]/g, '_')
  const cleanRoom = metadata.room.replace(/[^a-zA-Z0-9]/g, '_')
  const cleanItem = metadata.item
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30)
  return `NHome_${cleanProperty}_${cleanUnit}_${cleanRoom}_${cleanItem}_${timestamp}.jpg`
}

const deriveKey = (photo: NHomePhoto): string => {
  if (photo.supabase_photo_id) return `supabase:${photo.supabase_photo_id}`
  if (photo.storage_url) return `storage:${photo.storage_url}`
  if (photo.supabase_url) return `storage:${photo.supabase_url}`
  return `local:${fileNameFromMetadata(photo.metadata)}`
}

const createRemotePhoto = (
  record: RemotePhotoRecord,
  sessionId: string
): NHomePhoto | null => {
  const signedUrl = record.signed_url ?? null
  if (!signedUrl) return null

  const createdAt = record.created_at ? new Date(record.created_at).getTime() : Date.now()
  const fileName = record.file_name ?? `photo-${record.id}`

  const rawMeta = record.metadata as NHomePhotoMetadata | null
  const metadata: NHomePhotoMetadata = {
    inspector: rawMeta?.inspector || record.inspector_name || 'NHome Inspector',
    company: rawMeta?.company ?? DEFAULT_METADATA.company,
    property: rawMeta?.property ?? DEFAULT_METADATA.property,
    unit: rawMeta?.unit ?? DEFAULT_METADATA.unit,
    room: rawMeta?.room ?? DEFAULT_METADATA.room,
    item: rawMeta?.item ?? fileName,
    timestamp: rawMeta?.timestamp ?? new Date(createdAt).toISOString(),
    location: rawMeta?.location ?? DEFAULT_METADATA.location,
    quality_standards: rawMeta?.quality_standards ?? DEFAULT_METADATA.quality_standards,
    sessionId: rawMeta?.sessionId ?? sessionId,
  }

  return {
    id: `remote_${record.id}`,
    supabase_photo_id: record.id,
    sessionId,
    url: signedUrl,
    file_name: fileName,
    metadata,
    itemId: record.item_id ?? undefined,
    timestamp: createdAt,
    uploaded: true,
    storage_url: signedUrl,
    supabase_url: signedUrl,
    file_size: record.file_size ?? undefined,
    image_dimensions: record.image_dimensions ?? undefined,
  }
}

const mergePhotos = (existing: NHomePhoto[], incoming: NHomePhoto[]) => {
  if (incoming.length === 0) return existing

  const bySupabaseId = new Map<string, NHomePhoto>()
  for (const photo of incoming) {
    if (photo.supabase_photo_id) {
      bySupabaseId.set(photo.supabase_photo_id, photo)
    }
  }

  const merged = existing.map(photo => {
    if (photo.supabase_photo_id && bySupabaseId.has(photo.supabase_photo_id)) {
      const remote = bySupabaseId.get(photo.supabase_photo_id)!
      bySupabaseId.delete(photo.supabase_photo_id)
      return { ...photo, ...remote, uploaded: true }
    }
    return photo
  })

  const existingKeys = new Set(merged.map(deriveKey))
  for (const photo of bySupabaseId.values()) {
    const key = deriveKey(photo)
    if (!existingKeys.has(key)) {
      merged.push(photo)
    }
  }

  return merged
}

export function useNHomePhotoCapture(sessionId?: string) {
  const [photos, setPhotos] = useState<NHomePhoto[]>([])
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [currentItemId, setCurrentItemId] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    const activeSession =
      sessionId ??
      (typeof window !== 'undefined'
        ? sessionStorage.getItem('currentSessionId') ?? undefined
        : undefined)

    if (typeof window !== 'undefined' && sessionId) {
      sessionStorage.setItem('currentSessionId', sessionId)
    }

    ;(async () => {
      try {
        const all = await idbGetAll<NHomePhoto>()
        const filtered = activeSession
          ? all.filter(p => (p.sessionId ?? p.metadata?.sessionId) === activeSession)
          : all

        if (!cancelled) {
          setPhotos(filtered)
        }
      } catch (err) {
        console.warn('Failed to load NHome photos from IndexedDB', err)
        if (!cancelled) setPhotos([])
      }
    })()

    if (activeSession) {
      ;(async () => {
        try {
          const res = await fetch(`/api/nhome/inspections/${activeSession}/photos`, {
            cache: 'no-store',
          })
          if (!res.ok) {
            console.warn('Failed to fetch persisted photos', activeSession, res.status)
            return
          }
          const payload = await res.json()
          const remoteRows: RemotePhotoRecord[] = Array.isArray(payload?.photos)
            ? payload.photos
            : []
          const remotePhotos = remoteRows
            .map(record => createRemotePhoto(record, activeSession))
            .filter((p): p is NHomePhoto => Boolean(p))

          if (cancelled || remotePhotos.length === 0) return
          setPhotos(prev => mergePhotos(prev, remotePhotos))
        } catch (err) {
          console.warn('Failed to merge persisted photos', err)
        }
      })()
    }

    return () => {
      cancelled = true
      setPhotos([])
    }
  }, [sessionId])

  const openNHomeCamera = (itemId?: string) => {
    setCurrentItemId(itemId || '')
    setIsCameraOpen(true)
  }

  const closeNHomeCamera = () => {
    setIsCameraOpen(false)
    setCurrentItemId('')
  }

  const addNHomePhoto = (blob: Blob, url: string, metadata: NHomePhotoMetadata) => {
    const scopedMetadata: NHomePhotoMetadata = {
      ...metadata,
      sessionId: sessionId ?? metadata.sessionId,
    }

    const photo: NHomePhoto = {
      id: `nhome_photo_${Date.now()}`,
      blob,
      url,
      metadata: scopedMetadata,
      itemId: currentItemId,
      timestamp: Date.now(),
      uploaded: false,
      sessionId,
    }

    setPhotos(prev => {
      const next = [...prev, photo]
      idbPut<NHomePhoto>(photo).catch(err => console.warn('Failed to persist photo', err))
      return next
    })
    return photo
  }

  const removeNHomePhoto = (photoId: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === photoId)
      if (photo) {
        if (!photo.supabase_photo_id && photo.url) {
          URL.revokeObjectURL(photo.url)
        }
        idbDelete(photoId).catch(err => console.warn('Failed to delete photo', err))
      }
      return prev.filter(p => p.id !== photoId)
    })
  }

  const getNHomePhotosForItem = (itemId: string) => {
    return photos.filter(photo => photo.itemId === itemId)
  }

  const markPhotoUploaded = (
    photoId: string,
    supabaseUrl: string,
    persisted?: RemotePhotoRecord | null
  ) => {
    setPhotos(prev => {
      const next = prev.map(photo => {
        if (photo.id !== photoId) return photo

        const persistedMeta = (persisted?.metadata as NHomePhotoMetadata | null) ?? null
        const mergedMetadata: NHomePhotoMetadata = {
          ...photo.metadata,
          ...persistedMeta,
          inspector:
            persistedMeta?.inspector ??
            photo.metadata.inspector ??
            persisted?.inspector_name ??
            'NHome Inspector',
          sessionId: persistedMeta?.sessionId ?? sessionId ?? photo.metadata.sessionId,
          item: persistedMeta?.item ?? photo.metadata.item,
          timestamp: persistedMeta?.timestamp ?? photo.metadata.timestamp,
        }

        return {
          ...photo,
          uploaded: true,
          url: supabaseUrl,
          storage_url: supabaseUrl,
          supabase_url: supabaseUrl,
          onedrive_url: supabaseUrl,
          supabase_photo_id: persisted?.id ?? photo.supabase_photo_id,
          sessionId: sessionId ?? photo.sessionId,
          file_name: persisted?.file_name ?? photo.file_name,
          metadata: mergedMetadata,
          file_size: persisted?.file_size ?? photo.file_size,
          image_dimensions: persisted?.image_dimensions ?? photo.image_dimensions,
          blob: photo.blob ?? ({} as Blob),
        } as NHomePhoto
      })

      const updated = next.find(p => p.id === photoId)
      if (updated) {
        openDB()
          .then(db => {
            const tx = db.transaction(STORE, 'readwrite')
            const store = tx.objectStore(STORE)
            const req = store.get(photoId)
            req.onsuccess = () => {
              const record = req.result
              if (record) {
                record.url = supabaseUrl
                record.uploaded = true
                record.onedrive_url = supabaseUrl
                record.storage_url = supabaseUrl
                record.supabase_photo_id = persisted?.id ?? record.supabase_photo_id
                record.sessionId = sessionId ?? record.sessionId
                record.file_name = persisted?.file_name ?? record.file_name
                record.metadata = {
                  ...(record.metadata || {}),
                  ...(persisted?.metadata || {}),
                  inspector:
                    persisted?.metadata?.inspector ??
                    record.metadata?.inspector ??
                    persisted?.inspector_name ??
                    'NHome Inspector',
                  sessionId: persisted?.metadata?.sessionId ?? sessionId ?? record.sessionId,
                }
                record.file_size = persisted?.file_size ?? record.file_size
                record.image_dimensions = persisted?.image_dimensions ?? record.image_dimensions
                delete record.blob
                store.put(record)
              }
            }
            req.onerror = () =>
              console.warn('Failed to fetch record for update', req.error)
          })
          .catch(err => console.warn('Failed to update Supabase URL in IndexedDB', err))
      }

      return next
    })
  }

  const updateUploadProgress = (photoId: string, progress: number) => {
    setUploadProgress(prev => ({
      ...prev,
      [photoId]: progress,
    }))
  }

  const generateNHomeFileName = useMemo(
    () => (metadata: NHomePhotoMetadata) => fileNameFromMetadata(metadata),
    []
  )

  return {
    photos,
    isCameraOpen,
    currentItemId,
    uploadProgress,
    openNHomeCamera,
    closeNHomeCamera,
    addNHomePhoto,
    removeNHomePhoto,
    getNHomePhotosForItem,
    markPhotoUploaded,
    updateUploadProgress,
    generateNHomeFileName,
  }
}

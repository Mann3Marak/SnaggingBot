"use client"
import { useEffect, useState } from 'react'
import type { NHomePhoto, NHomePhotoMetadata } from '@/types/nhome-photo'

// Minimal IndexedDB helpers for offline persistence
const DB_NAME = 'nhome-photos'
const STORE = 'photos'

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

export function useNHomePhotoCapture() {
  const [photos, setPhotos] = useState<NHomePhoto[]>([])
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [currentItemId, setCurrentItemId] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  useEffect(() => {
    // Load from IndexedDB on mount (client only)
    let mounted = true
    ;(async () => {
      try {
        const loaded = await idbGetAll<NHomePhoto>()
        if (mounted) setPhotos(loaded)
      } catch (e) {
        console.warn('Failed to load NHome photos from IndexedDB', e)
      }
    })()
    return () => { mounted = false }
  }, [])

  const openNHomeCamera = (itemId?: string) => {
    setCurrentItemId(itemId || '')
    setIsCameraOpen(true)
  }

  const closeNHomeCamera = () => {
    setIsCameraOpen(false)
    setCurrentItemId('')
  }

  const addNHomePhoto = (blob: Blob, url: string, metadata: NHomePhotoMetadata) => {
    const photo: NHomePhoto = {
      id: `nhome_photo_${Date.now()}`,
      blob,
      url,
      metadata,
      itemId: currentItemId,
      timestamp: Date.now(),
      uploaded: false
    }

    setPhotos(prev => {
      const next = [...prev, photo]
      // Persist async; not awaited to keep UI snappy
      idbPut<NHomePhoto>(photo).catch(err => console.warn('Failed to persist photo', err))
      return next
    })
    return photo
  }

  const removeNHomePhoto = (photoId: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === photoId)
      if (photo) {
        URL.revokeObjectURL(photo.url)
        idbDelete(photoId).catch(err => console.warn('Failed to delete photo', err))
      }
      return prev.filter(p => p.id !== photoId)
    })
  }

  const getNHomePhotosForItem = (itemId: string) => {
    return photos.filter(photo => photo.itemId === itemId)
  }

  const markPhotoUploaded = (photoId: string, supabase_url: string) => {
    setPhotos(prev => {
      const next = prev.map(photo =>
        photo.id === photoId
          ? ({
              ...photo,
              uploaded: true,
              url: supabase_url,
              onedrive_url: supabase_url,
              blob: photo.blob ?? ({} as Blob) // maintain type safety
            } as NHomePhoto)
          : photo
      )
      const updated = next.find(p => p.id === photoId)
      if (updated) {
        // Directly update the existing record in IndexedDB with Supabase URL
        openDB()
          .then(db => {
            const tx = db.transaction(STORE, "readwrite");
            const store = tx.objectStore(STORE);
            const req = store.get(photoId);
            req.onsuccess = () => {
              const record = req.result;
              if (record) {
                record.url = supabase_url;
                record.uploaded = true;
                record.onedrive_url = supabase_url;
                delete record.blob; // remove blob reference
                store.put(record);
              }
            };
            req.onerror = () => console.warn("Failed to fetch record for update", req.error);
          })
          .catch(err => console.warn("Failed to update Supabase URL in IndexedDB", err));
      }
      return next
    })
  }

  const updateUploadProgress = (photoId: string, progress: number) => {
    setUploadProgress(prev => ({
      ...prev,
      [photoId]: progress
    }))
  }

  const generateNHomeFileName = (metadata: NHomePhotoMetadata): string => {
    const timestamp = new Date(metadata.timestamp).toISOString().replace(/[:.]/g, '-')
    const cleanProperty = metadata.property.replace(/[^a-zA-Z0-9]/g, '_')
    const cleanUnit = metadata.unit.replace(/[^a-zA-Z0-9]/g, '_')
    const cleanRoom = metadata.room.replace(/[^a-zA-Z0-9]/g, '_')
    const cleanItem = metadata.item.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30)
    
    return `NHome_${cleanProperty}_${cleanUnit}_${cleanRoom}_${cleanItem}_${timestamp}.jpg`
  }

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
    generateNHomeFileName
  }
}

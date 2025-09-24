"use client"
import { useParams } from 'next/navigation'
import { NHomeVoiceInspectionWithPhotos } from '@/components/inspection/NHomeVoiceInspectionWithPhotos'

export default function Page() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId
  return <NHomeVoiceInspectionWithPhotos sessionId={sessionId} />
}


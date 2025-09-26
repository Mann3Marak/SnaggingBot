'use client'

import { useCallback, useRef, useState } from 'react'

type AllowedRole = 'system' | 'user'

interface StopOptions {
  keepTranscripts?: boolean
  silent?: boolean
}

export interface UseRealtimeVoiceSessionOptions {
  tokenPath?: string
  onUserTranscriptFinal?: (text: string) => void
  onEvent?: (event: any) => void
}

export interface RealtimeVoiceSessionState {
  status: string
  isActive: boolean
  isConnecting: boolean
  userTurns: string[]
  liveUserTranscript: string
  assistantMessages: string[]
  logs: string[]
}

export interface RealtimeVoiceSessionControls {
  startSession: () => Promise<void>
  stopSession: (options?: StopOptions) => void
  resetTranscripts: () => void
  sendTextMessage: (text: string, role?: AllowedRole, respond?: boolean) => void
  updateSessionInstructions: (instructions: string) => void
}

export type UseRealtimeVoiceSessionReturn = RealtimeVoiceSessionState & RealtimeVoiceSessionControls

const DEFAULT_STATUS = 'Idle'
const DEFAULT_TOKEN_PATH = '/api/voice/token'

const DELTA_TYPES = new Set([
  'conversation.item.input_audio_transcription.delta',
  'response.output_text.delta',
  'response.output_audio_transcript.delta',
])

export function useRealtimeVoiceSession(options: UseRealtimeVoiceSessionOptions = {}): UseRealtimeVoiceSessionReturn {
  const { tokenPath = DEFAULT_TOKEN_PATH, onUserTranscriptFinal, onEvent } = options

  const [status, setStatus] = useState(DEFAULT_STATUS)
  const [isActive, setIsActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [userTurns, setUserTurns] = useState<string[]>([])
  const [liveUserTranscript, setLiveUserTranscript] = useState('')
  const [assistantMessages, setAssistantMessages] = useState<string[]>([])
  const [logs, setLogs] = useState<string[]>([])

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null)
  const assistantMapRef = useRef<Map<string, string>>(new Map())
  const assistantOrderRef = useRef<string[]>([])
  const sessionActiveRef = useRef(false)

  const logEvent = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => {
      const next = [...prev, `${timestamp} ${message}`]
      return next.slice(-200)
    })
  }, [])

  const resetAssistantState = useCallback(() => {
    assistantMapRef.current.clear()
    assistantOrderRef.current = []
    setAssistantMessages([])
  }, [])

  const resetTranscripts = useCallback(() => {
    setUserTurns([])
    setLiveUserTranscript('')
    resetAssistantState()
  }, [resetAssistantState])

  const cleanupMedia = useCallback(() => {
    const local = localStreamRef.current
    if (local) {
      try {
        local.getTracks().forEach((track) => track.stop())
      } catch {/* ignore stop errors */}
    }
    localStreamRef.current = null

    const remoteAudio = remoteAudioElRef.current
    if (remoteAudio) {
      try {
        remoteAudio.pause()
        remoteAudio.srcObject = null
        remoteAudio.remove()
      } catch {/* ignore audio cleanup errors */}
    }
    remoteAudioElRef.current = null
  }, [])

  const waitForIceGathering = useCallback(async (pc: RTCPeerConnection) => {
    if (pc.iceGatheringState === 'complete') {
      return
    }
    await new Promise<void>((resolve) => {
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState)
          resolve()
        }
      }
      pc.addEventListener('icegatheringstatechange', checkState)
    })
  }, [])

  const mergeAssistantText = useCallback((responseId: string, delta: string) => {
    if (!responseId || typeof delta !== 'string') {
      return
    }
    const map = assistantMapRef.current
    const order = assistantOrderRef.current
    if (!map.has(responseId)) {
      map.set(responseId, delta)
      order.push(responseId)
    } else {
      map.set(responseId, `${map.get(responseId) ?? ''}${delta}`)
    }
    setAssistantMessages(order.map((id) => map.get(id) ?? ''))
  }, [])

  const finalizeAssistantText = useCallback((responseId: string, text: string) => {
    if (!responseId || typeof text !== 'string') {
      return
    }
    const clean = text.trim()
    const map = assistantMapRef.current
    const order = assistantOrderRef.current
    if (!map.has(responseId)) {
      order.push(responseId)
    }
    map.set(responseId, clean)
    setAssistantMessages(order.map((id) => map.get(id) ?? ''))
  }, [])

  const handleServerEvent = useCallback((rawData: string) => {
    let event: any
    try {
      event = JSON.parse(rawData)
    } catch (error) {
      logEvent('Received non-JSON message from realtime channel.')
      return
    }

    if (!event?.type) {
      return
    }

    if (!DELTA_TYPES.has(event.type)) {
      logEvent(`Realtime event: ${event.type}`)
    }

    switch (event.type) {
      case 'conversation.item.input_audio_transcription.delta': {
        if (typeof event.delta === 'string') {
          setLiveUserTranscript((prev) => `${prev}${event.delta}`)
        }
        break
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = typeof event.transcript === 'string' ? event.transcript.trim() : ''
        if (transcript) {
          setUserTurns((prev) => [...prev, transcript])
          onUserTranscriptFinal?.(transcript)
        }
        setLiveUserTranscript('')
        break
      }
      case 'response.output_audio_transcript.delta': {
        if (typeof event.delta === 'string') {
          mergeAssistantText(event.response_id, event.delta)
        }
        break
      }
      case 'response.output_audio_transcript.done': {
        if (typeof event.transcript === 'string') {
          finalizeAssistantText(event.response_id, event.transcript)
        }
        break
      }
      case 'response.output_text.delta': {
        if (typeof event.delta === 'string') {
          mergeAssistantText(event.response_id, event.delta)
        }
        break
      }
      case 'response.output_text.done': {
        if (Array.isArray(event.output_text)) {
          const text = event.output_text.filter((chunk: unknown) => typeof chunk === 'string').join(' ')
          finalizeAssistantText(event.response_id, text)
        } else if (typeof event.output_text === 'string') {
          finalizeAssistantText(event.response_id, event.output_text)
        }
        break
      }
      case 'response.done': {
        const chunks: string[] = Array.isArray(event.response?.output)
          ? event.response.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
              .filter((part: any) => part?.type === 'output_text' && typeof part.text === 'string')
              .map((part: any) => part.text)
          : []
        if (chunks.length) {
          finalizeAssistantText(event.response?.id ?? event.response_id, chunks.join(' '))
        }
        break
      }
      default:
        break
    }

    if (onEvent) {
      onEvent(event)
    }
  }, [finalizeAssistantText, logEvent, mergeAssistantText, onEvent, onUserTranscriptFinal])

  const sendEvent = useCallback((payload: any) => {
    const channel = dcRef.current
    if (!channel || channel.readyState !== 'open') {
      logEvent('Realtime data channel is not open; event not sent.')
      return false
    }
    try {
      channel.send(JSON.stringify(payload))
      return true
    } catch (error) {
      logEvent('Failed to send event over realtime channel.')
      return false
    }
  }, [logEvent])

  const updateSessionInstructions = useCallback((instructions: string) => {
    if (!instructions?.trim()) {
      return
    }
    sendEvent({
      type: 'session.update',
      session: { instructions },
    })
  }, [sendEvent])

  const sendTextMessage = useCallback((text: string, role: AllowedRole = 'user', respond = true) => {
    const trimmed = text?.trim()
    if (!trimmed) {
      return
    }
    const dispatched = sendEvent({
      type: 'conversation.item.create',
      item: {
        role,
        content: [
          {
            type: 'input_text',
            text: trimmed,
          },
        ],
      },
    })
    if (dispatched && respond) {
      sendEvent({ type: 'response.create' })
    }
  }, [sendEvent])

  const stopSession = useCallback((options: StopOptions = {}) => {
    const { keepTranscripts = true, silent = false } = options
    const channel = dcRef.current
    if (channel) {
      try {
        if (channel.readyState === 'open' || channel.readyState === 'connecting') {
          channel.close()
        }
      } catch {/* ignore */}
    }
    dcRef.current = null

    const pc = pcRef.current
    if (pc) {
      try {
        pc.close()
      } catch {/* ignore */}
    }
    pcRef.current = null

    cleanupMedia()

    sessionActiveRef.current = false
    setIsActive(false)
    setIsConnecting(false)
    setStatus(DEFAULT_STATUS)

    if (!keepTranscripts) {
      resetTranscripts()
    }

    if (!silent) {
      logEvent('Realtime session stopped.')
    }
  }, [cleanupMedia, logEvent, resetTranscripts])

  const startSession = useCallback(async () => {
    if (typeof window === 'undefined') {
      throw new Error('Realtime voice sessions require a browser environment.')
    }
    if (sessionActiveRef.current || isConnecting) {
      return
    }

    setIsConnecting(true)
    setStatus('Requesting microphone access...')
    logEvent('Starting realtime voice session.')

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      localStreamRef.current = localStream
    } catch (error: any) {
      setStatus('Microphone access required.')
      logEvent(`Microphone error: ${error?.message ?? error}`)
      setIsConnecting(false)
      return
    }

    setStatus('Fetching ephemeral key...')

    let ephemeralKey: string | null = null
    try {
      const tokenResponse = await fetch(tokenPath)
      if (!tokenResponse.ok) {
        throw new Error(`Token request failed (${tokenResponse.status})`)
      }
      const tokenJson = await tokenResponse.json()
      const rawSecret = tokenJson?.value ?? tokenJson?.client_secret?.value ?? tokenJson?.client_secret ?? tokenJson?.secret
      if (typeof rawSecret === 'string') {
        ephemeralKey = rawSecret
      } else if (rawSecret && typeof rawSecret?.value === 'string') {
        ephemeralKey = rawSecret.value
      }
      if (!ephemeralKey) {
        throw new Error('Token response missing client secret value.')
      }
      // Basic sanity check: Realtime ephemeral keys start with ek_
      if (!ephemeralKey.startsWith('ek_')) {
        throw new Error('Invalid ephemeral key format received from token endpoint.')
      }
    } catch (error: any) {
      setStatus('Unable to reach token endpoint.')
      logEvent(`Token error: ${error?.message ?? error}`)
      cleanupMedia()
      setIsConnecting(false)
      return
    }

    try {
      const pc = new RTCPeerConnection()
      pcRef.current = pc
      const localStream = localStreamRef.current!
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))

      if (typeof document !== 'undefined') {
        const remoteAudio = document.createElement('audio')
        remoteAudio.autoplay = true
        remoteAudio.playsInline = true
        remoteAudio.hidden = true
        document.body.append(remoteAudio)
        remoteAudioElRef.current = remoteAudio
      }

      pc.addEventListener('track', (event) => {
        const remoteAudio = remoteAudioElRef.current
        if (remoteAudio) {
          remoteAudio.srcObject = event.streams[0]
        }
      })

      pc.addEventListener('connectionstatechange', () => {
        const state = pc.connectionState
        logEvent(`Peer connection state: ${state}`)
        if (state === 'connected') {
          setStatus('Connected. Listening...')
        } else if (state === 'disconnected' || state === 'failed') {
          setStatus('Connection lost.')
          stopSession({ keepTranscripts: true, silent: true })
        }
      })

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc

      dc.addEventListener('open', () => {
        sessionActiveRef.current = true
        setIsActive(true)
        setIsConnecting(false)
        setStatus('Channel open. Listening...')
        logEvent('Realtime data channel established.')
      })

      dc.addEventListener('close', () => {
        logEvent('Realtime data channel closed.')
      })

      dc.addEventListener('error', (event) => {
        const err = (event as RTCErrorEvent)?.error
        logEvent(`Data channel error${err?.message ? `: ${err.message}` : ''}`)
      })

      dc.addEventListener('message', (event) => {
        if (typeof event.data === 'string') {
          handleServerEvent(event.data)
        }
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await waitForIceGathering(pc)

      setStatus('Connecting to OpenAI...')
      const response = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp ?? '',
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Realtime API error (${response.status}): ${errText}`)
      }

      const answerSdp = await response.text()
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: answerSdp,
      }
      await pc.setRemoteDescription(answer)
      logEvent('SDP negotiation complete.')

      if (!sessionActiveRef.current) {
        setIsConnecting(false)
        setStatus('Awaiting channel...')
      }
    } catch (error: any) {
      setStatus('Failed to start session.')
      logEvent(`Startup error: ${error?.message ?? error}`)
      stopSession({ keepTranscripts: false, silent: true })
      setIsConnecting(false)
    }
  }, [cleanupMedia, handleServerEvent, isConnecting, logEvent, stopSession, tokenPath, waitForIceGathering])

  return {
    status,
    isActive,
    isConnecting,
    userTurns,
    liveUserTranscript,
    assistantMessages,
    logs,
    startSession,
    stopSession,
    resetTranscripts,
    sendTextMessage,
    updateSessionInstructions,
  }
}

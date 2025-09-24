export class NHomeVoiceAgent {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private instructions: string | null = null
  private mediaStream: MediaStream | null = null
  private mediaSource: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private speechRec: any = null
  public onAssistantText?: (text: string) => void
  private textBuffer: string = ''
  private playbackInit = false
  private ephemeralKey: string | null = null
  private modelName: string | null = null
  private altAuthTried = false
  private wsAttempt = 0

  async connect(): Promise<void> {
    const res = await fetch('/api/voice/token')
    if (!res.ok) throw new Error('Failed to fetch NHome voice token')
    const data = await res.json()
    // GA client_secrets can return { value } or { client_secret: { value } }
    const rawSecret = (data?.client_secret?.value ?? data?.value ?? data?.client_secret ?? data?.secret)
    const secret: string | null =
      (typeof rawSecret === 'string' && rawSecret) ||
      (typeof rawSecret?.value === 'string' && rawSecret.value) ||
      null
    const model: string | null = typeof data?.model === 'string' ? data.model : 'gpt-4o-realtime-preview-2024-10-01'
    if (!secret || !model) throw new Error('Invalid client secret or model in token response')
    this.ephemeralKey = secret
    this.modelName = model
    this.altAuthTried = false
    this.wsAttempt = 0
    this.openSocket(false)
  }

  private openSocket(useAltProtocol: boolean) {
    const model = this.modelName
    const ephemeral = this.ephemeralKey
    if (!model || !ephemeral) throw new Error('Missing model or ephemeral key')

    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`
    // GA client secret subprotocol variants
    const variants: Array<string | string[]> = [
      ['realtime', 'openai-client-secret', ephemeral],
      ['realtime', `openai-client-secret.${ephemeral}`],
      [`openai-client-secret.${ephemeral}`],
    ]
    this.wsAttempt = Math.min(this.wsAttempt, variants.length - 1)
    const chosen = useAltProtocol ? variants[Math.min(this.wsAttempt + 1, variants.length - 1)] : variants[this.wsAttempt]
    this.ws = new WebSocket(url, chosen as any)

    this.ws.onopen = () => {
      console.log('Connected to NHome Voice Assistant with subprotocol(s):', (this.ws as any).protocol)
      this.wsAttempt = 0
      this.altAuthTried = false
      this.sendNHomeConfiguration()
    }

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse((e as MessageEvent).data as any)
        // Server error messages (auth or config)
        if (msg.type === 'error') {
          console.error('NHome Realtime error:', msg)
          const m: string = msg?.error?.message || ''
          if (/Missing bearer or basic authentication/i.test(m) || /Invalid realtime token/i.test(m)) {
            if (this.wsAttempt < 2) {
              this.wsAttempt++
              try { this.ws?.close() } catch {}
              this.openSocket(true)
              return
            }
          }
        }
        // Helper to append text deltas across schema variants
        const appendDelta = (delta: any) => {
          if (!delta) return
          if (typeof delta === 'string') {
            this.textBuffer += delta
            this.onAssistantText?.(this.textBuffer)
            return
          }
          // Nested under output_text.delta
          const nested = delta?.output_text?.delta
          if (typeof nested === 'string') {
            this.textBuffer += nested
            this.onAssistantText?.(this.textBuffer)
            return
          }
          // Some previews nest under output[...].content[...]
          const outputs = Array.isArray(delta?.output) ? delta.output : []
          for (const out of outputs) {
            const contents = Array.isArray(out?.content) ? out.content : []
            for (const part of contents) {
              // Accept either output_text.delta or a direct delta field
              if (part?.type === 'output_text.delta' && typeof part?.delta === 'string') {
                this.textBuffer += part.delta
              } else if (typeof part?.delta === 'string') {
                this.textBuffer += part.delta
              } else if (typeof part?.text === 'string') {
                // Fallback if previews send plain text chunks
                this.textBuffer += part.text
              }
            }
          }
          if (outputs.length) this.onAssistantText?.(this.textBuffer)
        }

        // Collect assistant text as it streams (schema-tolerant)
        if (msg.type === 'response.delta') {
          appendDelta(msg.delta)
        }
        if (msg.type === 'response.output_text.delta') {
          appendDelta(msg.delta)
        }
        // Audio streaming (PCM16 base64) with field fallback
        if (msg.type === 'response.output_audio.delta') {
          const b64 = (msg.audio || msg.delta)
          if (typeof b64 === 'string') this.enqueuePcm16Base64(b64)
        }
        if (msg.type === 'response.completed') {
          // Finalize turn
          if (this.textBuffer) this.onAssistantText?.(this.textBuffer)
          this.textBuffer = ''
        }
      } catch {}
    }

    this.ws.onerror = (ev) => {
      console.warn('NHome Voice socket error', ev)
    }

    this.ws.onclose = (ev) => {
      console.log('NHome Voice socket closed', (ev as CloseEvent).code, (ev as CloseEvent).reason)
      this.ws = null
    }
  }

  disconnect(): void {
    try { this.ws?.close() } catch {}
    this.ws = null
    try { this.audioContext?.close() } catch {}
    this.audioContext = null
  }

  private sendNHomeConfiguration() {
    const msg = {
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions:
          this.instructions ??
          `You are the NHome Inspection Assistant, representing NHome Property Setup & Management in the Algarve, Portugal.\n\nCOMPANY CONTEXT:\n- Founded by Natalie O'Kelly\n- Specializing in professional property services in the Algarve\n- Maintaining the highest standards for international property owners\n- Website: www.nhomesetup.com\n\nINSPECTION BEHAVIOR:\n- Guide inspectors through systematic property evaluation\n- Use professional, confident language befitting NHome's reputation\n- Reference Algarve property standards when relevant\n- Acknowledge both English and Portuguese terminology\n- Maintain focus on quality and attention to detail\n\nRESPONSE STYLE:\n- Professional yet approachable (reflecting NHome's service)\n- Brief and action-oriented during inspections\n- Acknowledge NHome's commitment to excellence\n- Use phrases like "NHome standard," "professional assessment," "quality inspection"\n\nLANGUAGE SUPPORT:\n- Primarily English, but recognize Portuguese property terms\n- Understand Algarve-specific property features\n- Handle both casual and technical inspection language`,
        audio: {
          output: { voice: 'alloy', format: { type: 'pcm16' } },
          input: { format: { type: 'pcm16', sample_rate_hz: 16000 } },
        },
        temperature: 0.3,
        // Enable server-side VAD for hands-free turns
        turn_detection: { type: 'server_vad', threshold: 0.5 },
      },
    }
    this.ws?.send(JSON.stringify(msg))
  }

  updateInstructions(instructions: string) {
    this.instructions = instructions
    const msg = {
      type: 'session.update',
      session: { instructions },
    }
    try { this.ws?.send(JSON.stringify(msg)) } catch {}
  }

  sendMessage(text: string) {
    try {
      this.ws?.send(JSON.stringify({ type: 'input_text', text }))
      this.ws?.send(JSON.stringify({ type: 'response.create' }))
    } catch (e) {
      console.warn('Failed to send message to NHome voice session', e)
    }
  }

  async startListening(opts?: { onTranscript?: (text: string) => void }) {
    // Prefer Web Speech API for robust transcription if available
    const SR: any = (typeof window !== 'undefined') && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition)
    if (SR) {
      try {
        this.speechRec = new SR()
        this.speechRec.continuous = false
        this.speechRec.interimResults = true
        this.speechRec.lang = 'en-GB'
        let finalText = ''
        this.speechRec.onresult = (event: any) => {
          let interim = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) finalText += transcript
            else interim += transcript
          }
          if (finalText && opts?.onTranscript) {
            const text = finalText.trim()
            finalText = ''
            if (text) opts.onTranscript(text)
          }
        }
        this.speechRec.onerror = () => {}
        this.speechRec.start()
        return
      } catch {
        // fall through to streaming
      }
    }

    // Streaming fallback to Realtime API (basic PCM16 pipeline)
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Voice socket is not connected')
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    this.mediaStream = stream
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.mediaSource = this.audioContext.createMediaStreamSource(stream)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.mediaSource.connect(this.processor)
    this.processor.connect(this.audioContext.destination)

    const targetRate = 16000
    const resampleAndSend = (float32: Float32Array, inputRate: number) => {
      // Downsample to 16k mono and convert to 16-bit PCM
      const ratio = inputRate / targetRate
      const newLen = Math.floor(float32.length / ratio)
      const out = new Int16Array(newLen)
      let offset = 0
      for (let i = 0; i < newLen; i++) {
        const idx = Math.floor(i * ratio)
        let s = float32[idx]
        if (s > 1) s = 1
        else if (s < -1) s = -1
        out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }
      // Base64 encode
      const b = new Uint8Array(out.buffer)
      let binary = ''
      for (let i = 0; i < b.byteLength; i++) binary += String.fromCharCode(b[i])
      const base64 = btoa(binary)
      this.ws?.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 }))
    }

    this.processor.onaudioprocess = (e) => {
      try {
        const input = e.inputBuffer.getChannelData(0)
        resampleAndSend(input, this.audioContext!.sampleRate)
      } catch {}
    }
  }

  stopListening() {
    try { this.speechRec?.stop?.() } catch {}
    this.speechRec = null
    try { this.processor?.disconnect() } catch {}
    try { this.mediaSource?.disconnect() } catch {}
    try { this.mediaStream?.getTracks().forEach(t => t.stop()) } catch {}
    this.processor = null
    this.mediaSource = null
    this.mediaStream = null
    // finalize any buffered audio to trigger a response
    try {
      this.ws?.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
      this.ws?.send(JSON.stringify({ type: 'response.create' }))
    } catch {}
  }

  private ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (!this.playbackInit) {
      try { this.audioContext.resume() } catch {}
      this.playbackInit = true
    }
  }

  private enqueuePcm16Base64(base64: string) {
    try {
      this.ensureAudioContext()
      const bin = atob(base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const view = new DataView(bytes.buffer)
      const samples = new Float32Array(bytes.byteLength / 2)
      for (let i = 0; i < samples.length; i++) {
        const s = view.getInt16(i * 2, true)
        samples[i] = s / 0x8000
      }
      const sr = 16000
      const buffer = this.audioContext!.createBuffer(1, samples.length, sr)
      buffer.copyToChannel(samples, 0)
      const src = this.audioContext!.createBufferSource()
      src.buffer = buffer
      src.connect(this.audioContext!.destination)
      src.start()
    } catch { /* ignore playback issues */ }
  }
}

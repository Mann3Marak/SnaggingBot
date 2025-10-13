const BASE_SYSTEM_PROMPT =
  "You are the NHome voice assistant. Respond conversationally and professionally to the inspector's input. Keep responses concise and relevant.";

type AssistantCallback = (text: string) => void;

type StartListeningOptions = {
  onTranscript: (transcript: string) => void;
};

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionResultList = {
  length: number;
  item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
};

type NHomeSpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
};

type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((event: NHomeSpeechRecognitionEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return ctor ?? null;
}

export class NHomeVoiceAgent {
  private connected = false;
  private additionalInstructions: string | null = null;
  private messages: ConversationMessage[] = [];
  private listening = false;
  private pendingRequest: Promise<void> | null = null;
  private abortController: AbortController | null = null;

  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private ttsAudio: HTMLAudioElement | null = null;

  public onAssistantText?: AssistantCallback;

  async connect() {
    this.connected = true;
    // Prepare audio context for TTS playback
    if (typeof window !== "undefined") {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  updateInstructions(instructions: string) {
    const trimmed = instructions?.trim();
    this.additionalInstructions = trimmed?.length ? trimmed : null;
  }

  disconnect() {
    this.stopListening();
    this.connected = false;
    this.messages = [];
    this.abortController?.abort();
    this.abortController = null;
  }

  async startListening(options: StartListeningOptions) {
    if (!this.connected) throw new Error("Voice agent is not connected");
    if (this.listening) return;

    this.listening = true;
    this.audioChunks = [];

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        await this.sendToSTT(audioBlob, options.onTranscript);
      };
      this.mediaRecorder.start();
    } catch (err) {
      console.error("Failed to start microphone", err);
      this.listening = false;
    }
  }

  stopListening() {
    if (!this.listening) return;
    try {
      this.mediaRecorder?.stop();
      this.mediaStream?.getTracks().forEach(t => t.stop());
    } catch (error) {
      console.warn("Failed to stop recording", error);
    }
    this.listening = false;
  }

  async sendMessage(input: string, sessionId?: string) {
    if (!this.connected) throw new Error("Voice agent is not connected");

    const trimmed = input.trim();
    if (!trimmed) return;

    this.messages.push({ role: "user", content: trimmed });

    if (this.pendingRequest) {
      await this.pendingRequest;
    }

    const controller = new AbortController();
    this.abortController = controller;

    const request = this.fetchAssistantResponse(controller.signal, sessionId);
    this.pendingRequest = request;
    await request;
    this.pendingRequest = null;
  }

  private async fetchAssistantResponse(signal: AbortSignal, sessionId?: string) {
    try {
      const response = await fetch("/api/nhome/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal,
        body: JSON.stringify({
          instructions: this.additionalInstructions ?? undefined,
          messages: this.messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Assistant request failed: ${response.status}`);
      }

      const payload: { reply?: string } = await response.json();
      const reply = payload.reply?.trim();
      if (reply) {
        this.messages.push({ role: "assistant", content: reply });
        this.onAssistantText?.(reply);
        await this.speakWithTTS(reply);
      }
    } catch (error) {
      console.error("Failed to fetch assistant response", error);
      this.onAssistantText?.("There was an issue contacting the assistant. Please try again.");
    }
  }

  private async sendToSTT(audioBlob: Blob, onTranscript: (t: string) => void) {
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "speech.webm");
      const response = await fetch("/api/nhome/stt", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("STT request failed");
      const data = await response.json();
      if (data.transcript) {
        onTranscript(data.transcript);
      }
    } catch (err) {
      console.error("STT error", err);
    }
  }

  private async speakWithTTS(text: string) {
    try {
      const response = await fetch("/api/nhome/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("TTS request failed");
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      if (this.ttsAudio) {
        this.ttsAudio.pause();
      }
      this.ttsAudio = new Audio(url);
      this.ttsAudio.play();
    } catch (err) {
      console.error("TTS error", err);
    }
  }
}

export const DEFAULT_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

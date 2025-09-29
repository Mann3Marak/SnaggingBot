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
  private recognition: SpeechRecognition | null = null;
  private listening = false;
  private pendingRequest: Promise<void> | null = null;
  private abortController: AbortController | null = null;

  public onAssistantText?: AssistantCallback;

  async connect() {
    this.connected = true;
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (SpeechRecognitionCtor) {
      this.recognition = new SpeechRecognitionCtor();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = "en-US";
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
    if (!this.recognition) throw new Error("Speech recognition is not supported in this browser");
    if (this.listening) return;

    this.listening = true;

    this.recognition.onresult = (event: NHomeSpeechRecognitionEvent) => {
      const { results } = event;
      const lastIndex = results.length - 1;
      if (lastIndex < 0) return;
      const result = results[lastIndex];
      if (!result || !result.isFinal) return;
      const transcript = result[0]?.transcript?.trim();
      if (transcript) {
        options.onTranscript(transcript);
      }
    };

    this.recognition.onerror = () => {
      this.listening = false;
    };

    this.recognition.onend = () => {
      this.listening = false;
    };

    this.recognition.start();
  }

  stopListening() {
    if (!this.recognition || !this.listening) return;
    try {
      this.recognition.stop();
    } catch (error) {
      console.warn("Failed to stop speech recognition", error);
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
          messages: this.messages,
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
      }
    } catch (error) {
      console.error("Failed to fetch assistant response", error);
      this.onAssistantText?.("There was an issue contacting the assistant. Please try again.");
    }
  }
}

export const DEFAULT_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

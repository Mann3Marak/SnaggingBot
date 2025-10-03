/*
Legacy dev-only voice test component retained for reference.
"use client"
import { useEffect, useState } from "react"
import { NHomeVoiceAgent } from "@/lib/nhome-voice-agent"
import { NHomeLogo } from "@/components/NHomeLogo"

export function NHomeVoiceTest() {
  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [response, setResponse] = useState("")
  const [agent, setAgent] = useState<NHomeVoiceAgent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const a = new NHomeVoiceAgent()
    setAgent(a)
    return () => a.disconnect()
  }, [])

  const connect = async () => {
    if (!agent) return
    setError(null)
    try {
      await agent.connect()
      setIsConnected(true)
      setResponse("Connected to NHome Voice Assistant. Ready for professional inspection.")
    } catch (e: any) {
      setError(e?.message ?? "Failed to connect to NHome Voice Assistant")
    }
  }

  const testVoice = async () => {
    if (!agent || !isConnected) return
    setIsListening(true)
    setTranscript("")
    setResponse("NHome Assistant is listening...")

    const tests = [
      "Hello, I'm starting an apartment inspection in Quinta do Lago",
      "What should I check first in a T2 apartment?",
      "Kitchen counter has a scratch, what should I do?",
    ]
    const t = tests[Math.floor(Math.random() * tests.length)]
    setTranscript(`Testing: "${t}"`)
    setTimeout(() => {
      setResponse(
        "Excellent. As your NHome assistant, I recommend starting with the kitchen inspection. Document any issues according to our professional standards."
      )
      setIsListening(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <NHomeLogo variant="primary" size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-nhome-primary mb-2">Voice Assistant Test</h1>
          <p className="text-gray-600">Testing NHome professional voice integration</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error} � ensure OPENAI_API_KEY is set on the server.
            </div>
          )}
          <div className="text-center">
            {!isConnected ? (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-nhome-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-nhome-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  </svg>
                </div>
                <button onClick={connect} className="w-full bg-nhome-primary hover:bg-nhome-primary-dark text-white font-semibold py-3 px-6 rounded-lg transition-all">
                  Connect to NHome Assistant
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-nhome-success/10 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-nhome-success" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-nhome-success font-medium">? Connected to NHome Voice Assistant</p>
                <button onClick={testVoice} disabled={isListening} className={`w-full font-semibold py-3 px-6 rounded-lg transition-all ${isListening ? 'bg-nhome-error text-white animate-pulse' : 'bg-nhome-secondary hover:bg-nhome-secondary-dark text-white'}`}>
                  {isListening ? 'NHome Assistant Listening...' : 'Test Voice Interaction'}
                </button>
              </div>
            )}
          </div>
        </div>

        {(transcript || response) && (
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            {transcript && (
              <div className="border-l-4 border-nhome-secondary pl-4">
                <h4 className="font-semibold text-nhome-secondary mb-1">You said:</h4>
                <p className="text-gray-700">{transcript}</p>
              </div>
            )}
            {response && (
              <div className="border-l-4 border-nhome-primary pl-4">
                <h4 className="font-semibold text-nhome-primary mb-1">NHome Assistant:</h4>
                <p className="text-gray-700">{response}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-gradient-to-r from-nhome-primary/5 to-nhome-secondary/5 rounded-lg p-4 border border-nhome-primary/20">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-nhome-primary rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-nhome-primary mb-1">NHome Quality Standards</h4>
              <p className="text-sm text-gray-600">This voice assistant is configured around NHome's professional inspection standards for the Algarve property market.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

*/

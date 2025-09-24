"use client"
import { useState, useRef, useEffect } from 'react'
import { useNHomeInspectionSession } from '@/hooks/useNHomeInspectionSession'
import { useNHomePhotoCapture } from '@/hooks/useNHomePhotoCapture'
import { NHomePhotoUploadService } from '@/services/nhomePhotoUploadService'
import { NHomeCameraCapture } from '@/components/camera/NHomeCameraCapture'
import { NHomeLogo } from '@/components/NHomeLogo'
import { NHomeVoiceAgent } from '@/lib/nhome-voice-agent'

interface NHomeVoiceInspectionWithPhotosProps {
  sessionId: string
}

export function NHomeVoiceInspectionWithPhotos({ sessionId }: NHomeVoiceInspectionWithPhotosProps) {
  const { session, currentItem, nhomeProgress, saveNHomeResult } = useNHomeInspectionSession(sessionId)
  const { 
    isCameraOpen, 
    uploadProgress,
    openNHomeCamera, 
    closeNHomeCamera, 
    addNHomePhoto, 
    getNHomePhotosForItem,
    generateNHomeFileName,
    markPhotoUploaded,
    updateUploadProgress
  } = useNHomePhotoCapture()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [waitingForPhotoResponse, setWaitingForPhotoResponse] = useState(false)
  const [currentAssessment, setCurrentAssessment] = useState('')
  const [lastVoiceResponse, setLastVoiceResponse] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  
  const photoUploadService = useRef(new NHomePhotoUploadService())
  const voiceAgentRef = useRef<NHomeVoiceAgent | null>(null)

  useEffect(() => {
    (async () => {
      try {
        voiceAgentRef.current = new NHomeVoiceAgent()
        await voiceAgentRef.current.connect()
        voiceAgentRef.current.updateInstructions(`You are the professional NHome inspection assistant. Property: ${session?.project?.name ?? ''}. Unit ${session?.apartment?.unit_number ?? ''} (${session?.apartment?.apartment_type ?? ''}). Maintain professional tone and guide photo documentation as needed.`)
        voiceAgentRef.current.onAssistantText = (t: string) => {
          // Stream assistant messages into the UI
          setLastVoiceResponse(t)
        }
        setIsConnected(true)
      } catch (e) { console.warn('NHome voice connect failed', e) }
    })()
    return () => { try { voiceAgentRef.current?.disconnect() } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNHomeVoiceResponse = async (userInput: string) => {
    setIsProcessing(true)

    try {
      if (waitingForPhotoResponse) {
        if (/^(yes|yeah|yep|photo|take photo|document|capture)/i.test(userInput)) {
          openNHomeCamera(currentItem?.id)
          setWaitingForPhotoResponse(false)
          setLastVoiceResponse('Opening professional camera for documentation. Please capture clear photo of the issue.')
        } else {
          await moveToNextNHomeItem()
          setWaitingForPhotoResponse(false)
          setLastVoiceResponse('Issue documented without photo. Moving to next inspection item.')
        }
        return
      }

      const isGoodCondition = /^(good|fine|ok|okay|perfect|excellent|no issues?|meets nhome standards?|professional quality)$/i.test(userInput.trim())
      const isCriticalIssue = /\b(critical|urgent|major|serious|dangerous|immediate|safety|structural)\b/i.test(userInput.toLowerCase())
      
      if (!currentItem) return

      if (isGoodCondition) {
        await saveNHomeResult(currentItem.id, 'good', 'Meets NHome professional quality standards')
        setLastVoiceResponse('Excellent. This meets NHome\'s professional standards. Moving to the next inspection point.')
        await moveToNextNHomeItem()
      } else {
        const priority = isCriticalIssue ? 3 : /\b(minor|small|cosmetic|touch.?up)\b/i.test(userInput.toLowerCase()) ? 1 : 2
        const enhancedDescription = await enhanceNHomeDescription(userInput)
        
        setCurrentAssessment(enhancedDescription)
        await saveNHomeResult(currentItem.id, isCriticalIssue ? 'critical' : 'issue', enhancedDescription, priority)
        
        if (isCriticalIssue) {
          setLastVoiceResponse('Critical issue documented. Professional photo documentation is required for developer and safety records. Please capture photo now.')
          openNHomeCamera(currentItem.id)
        } else {
          setLastVoiceResponse('Issue documented according to NHome standards. Would you like to take a photo for comprehensive documentation?')
          setWaitingForPhotoResponse(true)
        }
      }

    } catch (error) {
      console.error('Error processing NHome voice response:', error)
      setLastVoiceResponse('Processing error occurred. Please repeat your assessment.')
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleMic = async () => {
    if (!isConnected) return
    try {
      if (isListening) {
        voiceAgentRef.current?.stopListening()
        setIsListening(false)
      } else {
        await voiceAgentRef.current?.startListening({
          onTranscript: (t: string) => {
            // Send to conversational assistant and to our workflow logic
            try { voiceAgentRef.current?.sendMessage(t) } catch {}
            handleNHomeVoiceResponse(t)
          },
        })
        setIsListening(true)
      }
    } catch (e) { console.warn('Mic toggle error', e) }
  }

  const handleNHomePhotoTaken = async (photoBlob: Blob, photoUrl: string, metadata: any) => {
    if (!currentItem) return

    const photo = addNHomePhoto(photoBlob, photoUrl, metadata)
    const fileName = generateNHomeFileName(metadata)
    setLastVoiceResponse('Professional photo captured. Uploading to NHome documentation system...')
    
    try {
      const result = await photoUploadService.current.uploadNHomeInspectionPhoto(
        photoBlob,
        metadata,
        sessionId,
        currentItem.id,
        fileName,
        (progress) => updateUploadProgress(photo.id, progress)
      )

      if (result.success) {
        markPhotoUploaded(photo.id, result.onedrive_url!)
        setLastVoiceResponse('Professional documentation complete. Photo uploaded to NHome client folder. Moving to next inspection item.')
        setTimeout(() => moveToNextNHomeItem(), 2000)
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      console.error('NHome photo upload error:', error)
      setLastVoiceResponse('Photo saved locally. Will upload when connection improves. Continuing with inspection.')
      setTimeout(() => moveToNextNHomeItem(), 1500)
    }
  }

  const moveToNextNHomeItem = async () => {
    setLastVoiceResponse('Proceeding with systematic NHome inspection. Moving to next item...')
    // The existing inspection page logic advances items after save; no extra action here.
  }

  const enhanceNHomeDescription = async (userInput: string): Promise<string> => {
    const response = await fetch('/api/nhome/enhance-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userInput,
        item: currentItem?.item_description,
        room: currentItem?.room_type,
        nhome_standards: currentItem?.nhome_standard_notes,
        property_type: session?.apartment?.apartment_type,
        location: 'Algarve, Portugal',
      }),
    })
    const { enhanced } = await response.json()
    return enhanced
  }

  if (!session || !currentItem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <NHomeLogo variant="primary" size="lg" className="mx-auto mb-4" />
          <div className="text-lg text-gray-600">Loading NHome professional inspection...</div>
        </div>
      </div>
    )
  }

  const currentItemPhotos = getNHomePhotosForItem(currentItem.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="bg-gradient-to-r from-nhome-primary to-nhome-secondary text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <NHomeLogo variant="white" size="md" />
            <div>
              <h1 className="font-bold text-lg">Professional Voice Inspection</h1>
              <p className="text-sm opacity-90">{session.project.name} • Unit {session.apartment.unit_number}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium">NHome Quality: {nhomeProgress.quality_score}/10</div>
            <div className="opacity-90">{nhomeProgress.issues_found} Issues Found</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <button
            onClick={toggleMic}
            disabled={!isConnected}
            className={`px-3 py-1 text-sm rounded-full border ${isListening ? 'bg-nhome-error text-white border-nhome-error' : 'bg-white text-nhome-primary border-nhome-primary'} disabled:opacity-60`}
          >{isListening ? 'Stop' : 'Speak'}</button>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-nhome-primary to-nhome-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-nhome-primary mb-2">{currentItem.room_type}</h2>
            <p className="text-lg text-gray-700 mb-4">{currentItem.item_description}</p>
            
            {currentItem.nhome_standard_notes && (
              <div className="bg-nhome-primary/10 border border-nhome-primary/20 rounded-lg p-3 text-sm text-nhome-primary">
                <strong>NHome Standards:</strong> {currentItem.nhome_standard_notes}
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Professional Inspection Progress</span>
              <span>{nhomeProgress.completed} of {nhomeProgress.total} items</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-nhome-primary to-nhome-secondary h-3 rounded-full transition-all duration-500"
                style={{ width: `${(nhomeProgress.completed / nhomeProgress.total) * 100}%` }}
              />
            </div>
            
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Quality Score: {nhomeProgress.quality_score}/10</span>
              <span>Issues: {nhomeProgress.issues_found}</span>
            </div>
          </div>

          <div className="text-center space-y-4">
            {isProcessing ? (
              <div className="text-nhome-primary">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nhome-primary mx-auto mb-2"></div>
                <div className="font-medium">Processing professional assessment...</div>
              </div>
            ) : waitingForPhotoResponse ? (
              <div className="text-nhome-warning">
                <div className="w-12 h-12 bg-nhome-warning rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z"/>
                  </svg>
                </div>
                <div className="font-medium">Say "yes" to document with photo</div>
                <div className="text-sm">Or "no" to continue without photo</div>
              </div>
            ) : (
              <div className="text-nhome-success">
                <div className="w-12 h-12 bg-nhome-success rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                </div>
                <div className="font-medium">Ready for professional assessment</div>
                <div className="text-sm">Describe condition or say "good" if meets NHome standards</div>
              </div>
            )}
          </div>

          {lastVoiceResponse && (
            <div className="mt-6 bg-nhome-primary/5 rounded-lg p-4 border border-nhome-primary/20">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-nhome-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-nhome-primary mb-1">NHome Assistant:</h4>
                  <p className="text-gray-700">{lastVoiceResponse}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {currentItemPhotos.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 text-nhome-primary mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V12H19V19Z"/>
              </svg>
              Professional Documentation - {currentItem.room_type}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentItemPhotos.map(photo => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.url}
                    alt="NHome professional documentation"
                    className="w-full h-24 object-cover rounded-lg border border-gray-200 shadow-sm"
                  />
                  {uploadProgress[photo.id] !== undefined && uploadProgress[photo.id] < 100 && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <div className="text-white text-xs">{uploadProgress[photo.id]}%</div>
                    </div>
                  )}
                  {photo.uploaded && (
                    <div className="absolute top-1 right-1 bg-nhome-success rounded-full p-1">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => openNHomeCamera(currentItem.id)}
            className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg hover:border-nhome-accent transition-all"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-nhome-accent rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z"/>
                </svg>
              </div>
              <p className="font-medium text-gray-900">Professional Photo</p>
              <p className="text-xs text-gray-600">Document with NHome standards</p>
            </div>
          </button>
          
          <button className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg hover:border-nhome-secondary transition-all">
            <div className="text-center">
              <div className="w-12 h-12 bg-nhome-secondary rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                </svg>
              </div>
              <p className="font-medium text-gray-900">Detailed Assessment</p>
              <p className="text-xs text-gray-600">Add professional notes</p>
            </div>
          </button>
        </div>

        <NHomeCameraCapture
          isOpen={isCameraOpen}
          onClose={closeNHomeCamera}
          onPhotoTaken={handleNHomePhotoTaken}
          inspectionItem={currentItem}
          sessionData={{
            project_name: session.project.name,
            apartment_unit: session.apartment.unit_number,
            apartment_type: session.apartment.apartment_type,
            inspector_name: 'NHome Inspector',
          }}
        />
      </div>
    </div>
  )
}

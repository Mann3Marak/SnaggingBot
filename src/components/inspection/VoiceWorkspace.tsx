"use client"

import { ChecklistItem, InspectionResult } from '@/hooks/useNHomeInspectionSession'

// ==================== TYPE DEFINITIONS ====================

export interface VoiceWorkspaceProps {
  // Current item
  currentItem: ChecklistItem | null
  currentResult: InspectionResult | null

  // Voice state
  isRecording: boolean
  isPlaying: boolean
  status: string
  activeStatus: string

  // Transcripts
  userTranscriptSegments: string[]
  assistantMessages: string[]
  lastResponse: string

  // Callbacks
  onToggleRecording: () => void
  onCapturePhoto: () => void
  onNavigatePrevious: () => void
  onNavigateNext: () => void

  // Photo management
  photos: any[] // Photo objects from useNHomePhotoCapture
  uploadProgress: Record<string, number>
  onRemovePhoto: (photoId: string) => void
  onUploadPhoto: (photoId: string, photoBlob: Blob, metadata: any) => Promise<void>
  generatePhotoFileName: (metadata: any) => string

  // Session data
  sessionId: string
  session: any
}

// ==================== COMPONENT ====================

export function VoiceWorkspace({
  currentItem,
  currentResult,
  isRecording,
  isPlaying,
  status,
  activeStatus,
  userTranscriptSegments,
  assistantMessages,
  lastResponse,
  onToggleRecording,
  onCapturePhoto,
  onNavigatePrevious,
  onNavigateNext,
  photos,
  uploadProgress,
  onRemovePhoto,
  onUploadPhoto,
  generatePhotoFileName,
  sessionId,
  session,
}: VoiceWorkspaceProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Voice Recording Button */}
      <div className="text-center space-y-2">
        <div className="flex justify-center items-center gap-6">
          <button
            onClick={onNavigatePrevious}
            className="px-5 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-semibold shadow-sm transition-all"
            aria-label="Previous item"
          >
            ← Previous
          </button>

          <button
            onClick={onToggleRecording}
            className={`w-16 h-16 flex items-center justify-center rounded-full text-white font-semibold shadow-md transition-all duration-200 ${
              isPlaying
                ? 'bg-blue-500 hover:bg-blue-600 scale-105'
                : isRecording
                  ? 'bg-red-500 hover:bg-red-600 scale-105 animate-pulse'
                  : 'bg-green-500 hover:bg-green-600 scale-105'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {isPlaying ? (
                <path d="M8 5v14l11-7z" />
              ) : isRecording ? (
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              ) : (
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              )}
            </svg>
          </button>

          <button
            onClick={onNavigateNext}
            className="px-5 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-semibold shadow-sm transition-all"
            aria-label="Next item"
          >
            Next →
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-lg font-medium text-gray-900">{activeStatus}</p>
          <p className="text-sm text-gray-600">{status}</p>
        </div>
      </div>

      {/* Last Response Highlight */}
      {lastResponse && (
        <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
          <h4 className="font-medium text-blue-900 mb-1 text-sm">NHome Assistant Update</h4>
          <p className="text-gray-700 text-sm">{lastResponse}</p>
        </div>
      )}

      {/* Transcripts */}
      <div className="space-y-4">
        {/* Inspector Transcript */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Inspector Transcript</h4>
          {userTranscriptSegments.length ? (
            <div className="space-y-2 text-sm text-gray-700">
              {userTranscriptSegments.map((segment, index) => (
                <p
                  key={`user-${index}`}
                  className={segment.startsWith('Listening:') ? 'italic text-gray-500' : ''}
                >
                  {segment}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Awaiting inspector input...</p>
          )}
        </div>

        {/* Assistant Transcript */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Assistant Transcript</h4>
          {assistantMessages.length ? (
            <div className="space-y-2 text-sm text-gray-700">
              {assistantMessages.map((message, index) => (
                <p key={`assistant-${index}`}>{message}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Assistant responses will appear here.</p>
          )}
        </div>
      </div>

      {/* Photo Capture Button */}
      <button
        onClick={onCapturePhoto}
        className="w-full bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg hover:border-blue-400 transition-all"
      >
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z" />
            </svg>
          </div>
          <p className="font-medium text-gray-900 text-sm">Capture Photo Evidence</p>
          <p className="text-xs text-gray-600">Attach visuals for the current item</p>
        </div>
      </button>

      {/* Photos for Current Item */}
      {currentItem && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Photos for this item</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Display photos from inspection_results.photo_urls */}
            {currentResult?.photo_urls?.length && currentResult.photo_urls.length > 0 && currentResult.photo_urls.map((url: string, index: number) => (
              <div key={`db-photo-${index}`} className="relative border rounded-lg overflow-hidden group">
                <img src={url} alt={`Inspection photo ${index + 1}`} className="w-full h-24 object-cover" />
                <div className="absolute top-1 left-1 text-[10px] bg-black/50 text-white rounded px-1">
                  Saved
                </div>
              </div>
            ))}

            {/* Display locally captured photos (not yet uploaded) */}
            {photos.map(photo => {
              const displayName = photo.file_name ?? generatePhotoFileName(photo.metadata)
              return (
                <div key={photo.id} className="relative border rounded-lg overflow-hidden group">
                  <img src={photo.url} alt={photo.metadata.item} className="w-full h-24 object-cover" />
                  <div className="absolute top-1 left-1 text-[10px] bg-black/50 text-white rounded px-1">
                    {photo.uploaded ? 'Uploaded' : uploadProgress[photo.id] ? `${Math.round(uploadProgress[photo.id])}%` : ''}
                  </div>
                  <button
                    onClick={() => onRemovePhoto(photo.id)}
                    type="button"
                    className="absolute top-1 right-1 bg-black/60 z-10 hover:bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove photo"
                  >
                    Remove
                  </button>
                  {!photo.uploaded && (
                    <button
                      onClick={() => onUploadPhoto(photo.id, photo.blob as Blob, photo.metadata)}
                      type="button"
                      className="absolute bottom-1 right-1 bg-blue-500 z-10 hover:opacity-90 text-white text-[10px] px-2 py-1 rounded"
                      title="Upload to NHome cloud storage"
                    >
                      Upload
                    </button>
                  )}
                  <div className="p-2 text-[10px] text-gray-600 truncate" title={displayName}>
                    {displayName}
                    {photo.uploaded && photo.storage_url && (
                      <a
                        href={photo.storage_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-2 pb-2 -mt-1 text-[10px] text-blue-600 hover:underline truncate"
                        title={photo.storage_url}
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {photos.length === 0 && (!currentResult?.photo_urls || currentResult.photo_urls.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-4">No photos yet. Capture photos to document issues.</p>
          )}

          <div className="mt-3">
            <button
              onClick={onCapturePhoto}
              className="text-sm text-blue-600 hover:underline"
            >
              + Add another photo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

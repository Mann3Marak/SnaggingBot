"use client"

import { RoomGroup } from '@/hooks/useNHomeInspectionSession'

// ==================== TYPE DEFINITIONS ====================

export interface MobileRoomSelectorProps {
  rooms: RoomGroup[]
  activeRoomId: string | null
  onSelectRoom: (roomId: string) => void
  results?: Map<string, any> // Map of item_id -> result
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Calculate completion count for a room (items with results)
 */
function calculateCompleted(room: RoomGroup, results?: Map<string, any>): number {
  if (!results || results.size === 0) return 0
  return room.items.filter(item => results.has(item.id)).length
}

/**
 * Get status icon for room based on completion
 */
function getRoomIcon(completed: number, total: number): string {
  if (completed === 0) return '○' // Not started
  if (completed === total) return '✓' // Complete
  return '◔' // In progress (partial)
}

// ==================== COMPONENT ====================

export function MobileRoomSelector({
  rooms,
  activeRoomId,
  onSelectRoom,
  results,
}: MobileRoomSelectorProps) {
  const activeRoom = rooms.find(r => r.roomId === activeRoomId)

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-4 py-3">
        <label
          htmlFor="mobile-room-select"
          className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2"
        >
          Room
        </label>
        <div className="relative">
          <select
            id="mobile-room-select"
            value={activeRoomId || ''}
            onChange={(e) => onSelectRoom(e.target.value)}
            className="w-full px-4 py-3 pr-10 text-base font-medium text-gray-900 bg-white border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            aria-label="Select room"
          >
            {rooms.length === 0 && (
              <option value="">No rooms available</option>
            )}
            {rooms.map(room => {
              const completed = calculateCompleted(room, results)
              const total = room.items.length
              const icon = getRoomIcon(completed, total)

              return (
                <option key={room.roomId} value={room.roomId}>
                  {icon} {room.roomLabel} ({completed}/{total})
                </option>
              )
            })}
          </select>

          {/* Dropdown arrow icon */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Current room info */}
        {activeRoom && (
          <div className="mt-2 text-xs text-gray-600">
            {(() => {
              const completed = calculateCompleted(activeRoom, results)
              const total = activeRoom.items.length
              const remaining = total - completed
              if (remaining === 0) {
                return `${total} items completed`
              }
              return `${remaining} item${remaining === 1 ? '' : 's'} remaining (${completed}/${total})`
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

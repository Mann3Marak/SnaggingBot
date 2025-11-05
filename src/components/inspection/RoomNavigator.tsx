"use client"

import { useState, useRef, useEffect, KeyboardEvent } from 'react'

// ==================== TYPE DEFINITIONS ====================

export interface StatusCounts {
  good: number
  issue: number
  critical: number
  skipped: number
  notApplicable: number
  pending: number
}

export interface RoomItem {
  roomId: string
  label: string
  counts: StatusCounts
}

export interface RoomNavigatorProps {
  rooms: RoomItem[]
  activeRoomId: string | null
  onSelectRoom: (roomId: string) => void
  searchTerm: string
  onSearch: (term: string) => void
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Calculate total outstanding items (non-good statuses)
 */
function calculateOutstanding(counts: StatusCounts): number {
  return counts.issue + counts.critical + counts.skipped + counts.notApplicable + counts.pending
}

/**
 * Get status badge color based on room status
 */
function getRoomStatusColor(counts: StatusCounts): string {
  if (counts.critical > 0) return 'bg-red-100 text-red-700'
  if (counts.issue > 0) return 'bg-orange-100 text-orange-700'
  if (counts.skipped > 0) return 'bg-blue-100 text-blue-700'
  if (counts.pending > 0) return 'bg-gray-100 text-gray-600'
  return 'bg-green-100 text-green-700' // All good
}

/**
 * Get room icon emoji based on room type
 */
function getRoomIcon(label: string): string {
  const lowerLabel = label.toLowerCase()
  if (lowerLabel.includes('kitchen')) return '🍳'
  if (lowerLabel.includes('bedroom') || lowerLabel.includes('room')) return '🛏️'
  if (lowerLabel.includes('bathroom') || lowerLabel.includes('bath')) return '🚿'
  if (lowerLabel.includes('living')) return '🛋️'
  if (lowerLabel.includes('balcony')) return '🌿'
  if (lowerLabel.includes('hallway') || lowerLabel.includes('corridor')) return '🚪'
  if (lowerLabel.includes('storage') || lowerLabel.includes('closet')) return '📦'
  if (lowerLabel.includes('laundry')) return '🧺'
  if (lowerLabel.includes('garage')) return '🚗'
  return '📍' // Default
}

// ==================== COMPONENT ====================

export function RoomNavigator({
  rooms,
  activeRoomId,
  onSelectRoom,
  searchTerm,
  onSearch,
}: RoomNavigatorProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Filter rooms based on search term (case-insensitive)
  const filteredRooms = rooms.filter((room) =>
    room.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Reset focused index when search changes
  useEffect(() => {
    setFocusedIndex(-1)
  }, [searchTerm])

  // Handle keyboard navigation
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (filteredRooms.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setFocusedIndex((prev) => {
          const next = prev < filteredRooms.length - 1 ? prev + 1 : 0
          focusItem(filteredRooms[next].roomId)
          return next
        })
        break

      case 'ArrowUp':
        event.preventDefault()
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filteredRooms.length - 1
          focusItem(filteredRooms[next].roomId)
          return next
        })
        break

      case 'Enter':
      case ' ':
        event.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < filteredRooms.length) {
          onSelectRoom(filteredRooms[focusedIndex].roomId)
        }
        break

      case 'Home':
        event.preventDefault()
        setFocusedIndex(0)
        focusItem(filteredRooms[0].roomId)
        break

      case 'End':
        event.preventDefault()
        const lastIndex = filteredRooms.length - 1
        setFocusedIndex(lastIndex)
        focusItem(filteredRooms[lastIndex].roomId)
        break
    }
  }

  const focusItem = (roomId: string) => {
    const button = itemRefs.current.get(roomId)
    if (button) {
      button.focus()
    }
  }

  const handleRoomClick = (roomId: string, index: number) => {
    setFocusedIndex(index)
    onSelectRoom(roomId)
  }

  return (
    <nav
      className="flex flex-col h-full bg-white border-r border-gray-200"
      role="navigation"
      aria-label="Room navigation"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Rooms</h2>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search rooms..."
            className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Search rooms"
          />
          {searchTerm && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Room List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        onKeyDown={handleKeyDown}
        role="list"
      >
        {filteredRooms.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {searchTerm ? 'No rooms found' : 'No rooms available'}
          </div>
        ) : (
          filteredRooms.map((room, index) => {
            const outstanding = calculateOutstanding(room.counts)
            const isActive = room.roomId === activeRoomId
            const statusColor = getRoomStatusColor(room.counts)
            const icon = getRoomIcon(room.label)

            return (
              <button
                key={room.roomId}
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(room.roomId, el)
                  } else {
                    itemRefs.current.delete(room.roomId)
                  }
                }}
                onClick={() => handleRoomClick(room.roomId, index)}
                className={`
                  w-full px-4 py-3 text-left border-l-4 transition-colors
                  hover:bg-gray-50
                  focus:outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500
                  ${isActive ? 'bg-blue-50 border-l-blue-500' : 'border-l-transparent'}
                `}
                role="listitem"
                aria-current={isActive ? 'location' : undefined}
                tabIndex={focusedIndex === index ? 0 : -1}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Room Label with Icon */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg" aria-hidden="true">
                        {icon}
                      </span>
                      <span className="font-medium text-gray-900 truncate">
                        {room.label}
                      </span>
                    </div>

                    {/* Status Counts */}
                    <div className="flex flex-wrap gap-1 text-xs">
                      {room.counts.critical > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-700">
                          ✗ {room.counts.critical}
                        </span>
                      )}
                      {room.counts.issue > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                          ⚠ {room.counts.issue}
                        </span>
                      )}
                      {room.counts.skipped > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          ⊘ {room.counts.skipped}
                        </span>
                      )}
                      {room.counts.pending > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          ○ {room.counts.pending}
                        </span>
                      )}
                      {room.counts.good > 0 && outstanding === 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-700">
                          ✓ All good
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Outstanding Badge */}
                  {outstanding > 0 && (
                    <div
                      className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold ${statusColor}`}
                      aria-label={`${outstanding} outstanding items`}
                    >
                      {outstanding}
                    </div>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Footer Summary */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Total Rooms:</span>
            <span className="font-semibold">{rooms.length}</span>
          </div>
          {searchTerm && (
            <div className="flex justify-between text-blue-600">
              <span>Filtered:</span>
              <span className="font-semibold">{filteredRooms.length}</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

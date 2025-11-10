"use client"

import { useMemo } from 'react'

// ==================== TYPE DEFINITIONS ====================

export type StatusValue = 'good' | 'issue' | 'critical' | 'skipped' | 'not_applicable' | 'pending'

export interface Item {
  id: string
  label: string
  status: StatusValue
  order: number
}

export interface StatusCounts {
  good: number
  issue: number
  critical: number
  skipped: number
  notApplicable: number
  pending: number
}

export interface RoomItemListProps {
  items: Item[]
  activeItemId: string | null
  onSelectItem: (itemId: string) => void
  onJumpNextPending: () => void
  roomName?: string
  counts?: StatusCounts
}

interface StatusDisplay {
  icon: string
  label: string
  bgColor: string
  textColor: string
  borderColor: string
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get display properties for each status
 */
function getStatusDisplay(status: StatusValue): StatusDisplay {
  switch (status) {
    case 'good':
      return {
        icon: '✓',
        label: 'Good',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
      }
    case 'issue':
      return {
        icon: '⚠',
        label: 'Issue',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200',
      }
    case 'critical':
      return {
        icon: '✗',
        label: 'Critical',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
      }
    case 'skipped':
      return {
        icon: '⊘',
        label: 'Skipped',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
      }
    case 'not_applicable':
      return {
        icon: '−',
        label: 'N/A',
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200',
      }
    case 'pending':
      return {
        icon: '○',
        label: 'Pending',
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-400',
        borderColor: 'border-gray-200',
      }
  }
}

/**
 * Calculate total outstanding items (non-good statuses)
 */
function calculateOutstanding(counts: StatusCounts): number {
  return counts.issue + counts.critical + counts.skipped + counts.notApplicable + counts.pending
}

// ==================== COMPONENT ====================

export function RoomItemList({
  items,
  activeItemId,
  onSelectItem,
  onJumpNextPending,
  roomName = 'Room Items',
  counts,
}: RoomItemListProps) {
  // Find the first pending item for quick navigation
  const firstPendingId = useMemo(() => {
    const pending = items.find((item) => item.status === 'pending')
    return pending?.id ?? null
  }, [items])

  const hasPendingItems = firstPendingId !== null

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-900">{roomName}</h2>
            {hasPendingItems && (
              <button
                onClick={onJumpNextPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                aria-label="Jump to next pending item"
              >
                <span>○</span>
                <span>Jump to Next Pending</span>
              </button>
            )}
          </div>

          {/* Status Summary */}
          {counts && (
            <div className="flex flex-wrap gap-3 text-xs">
              {counts.good > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700">
                  <span>✓</span>
                  <span className="font-medium">{counts.good} Good</span>
                </div>
              )}
              {counts.issue > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-100 text-orange-700">
                  <span>⚠</span>
                  <span className="font-medium">{counts.issue} Issue</span>
                </div>
              )}
              {counts.critical > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700">
                  <span>✗</span>
                  <span className="font-medium">{counts.critical} Critical</span>
                </div>
              )}
              {counts.skipped > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-700">
                  <span>⊘</span>
                  <span className="font-medium">{counts.skipped} Skipped</span>
                </div>
              )}
              {counts.notApplicable > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-600">
                  <span>−</span>
                  <span className="font-medium">{counts.notApplicable} N/A</span>
                </div>
              )}
              {counts.pending > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-400">
                  <span>○</span>
                  <span className="font-medium">{counts.pending} Pending</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="text-gray-400 mb-2 text-4xl">📋</div>
            <p className="text-gray-600 font-medium">No items in this room</p>
            <p className="text-gray-500 text-sm mt-1">
              Select a different room to view its checklist items
            </p>
          </div>
        ) : (
          <div role="list" className="divide-y divide-gray-100">
            {items.map((item) => {
              const isActive = item.id === activeItemId
              const display = getStatusDisplay(item.status)

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  className={`
                    w-full px-6 py-4 text-left transition-colors
                    hover:bg-gray-50
                    focus:outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500
                    ${isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}
                  `}
                  role="listitem"
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`${item.label}, status: ${display.label}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Item Label */}
                    <div className="flex-1 min-w-0">
<div className="flex items-center gap-2 mb-1">
  <h3 className="font-medium text-gray-900 truncate">
    {item.label}
  </h3>
</div>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={`
                        flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border
                        ${display.bgColor} ${display.textColor} ${display.borderColor}
                      `}
                    >
                      <span aria-hidden="true">{display.icon}</span>
                      <span className="text-xs font-semibold">{display.label}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {items.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Total Items: {items.length}</span>
            {counts && (
              <span className="font-semibold">
                Outstanding: {calculateOutstanding(counts)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

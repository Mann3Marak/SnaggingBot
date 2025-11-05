"use client"

import { ChecklistItem } from '@/hooks/useNHomeInspectionSession'

// ==================== TYPE DEFINITIONS ====================

export interface MobileItemSelectorProps {
  items: ChecklistItem[]
  activeItemId: string | null
  onSelectItem: (itemId: string) => void
  results?: Map<string, any> // InspectionResult map
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get status icon based on inspection result status
 */
function getStatusIcon(status: string | null): string {
  switch (status) {
    case 'good':
      return '✓' // Green checkmark
    case 'issue':
      return '⚠' // Orange warning
    case 'critical':
      return '✗' // Red X
    case 'skipped':
      return '⊘' // Blue skipped
    case 'not_applicable':
      return '−' // Gray N/A
    default:
      return '○' // Pending
  }
}

/**
 * Truncate long text for display in dropdown
 */
function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

// ==================== COMPONENT ====================

export function MobileItemSelector({
  items,
  activeItemId,
  onSelectItem,
  results,
}: MobileItemSelectorProps) {
  const activeItem = items.find(i => i.id === activeItemId)

  // Get status for an item from results map
  const getItemStatus = (itemId: string): string | null => {
    if (!results) return null
    const result = results.get(itemId)
    return result?.status ?? null
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-4 py-3">
        <label
          htmlFor="mobile-item-select"
          className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2"
        >
          Checklist Item
        </label>
        <div className="relative">
          <select
            id="mobile-item-select"
            value={activeItemId || ''}
            onChange={(e) => onSelectItem(e.target.value)}
            className="w-full px-4 py-3 pr-10 text-base font-medium text-gray-900 bg-white border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            aria-label="Select checklist item"
            disabled={items.length === 0}
          >
            {items.length === 0 && (
              <option value="">No items in this room</option>
            )}
            {items.map(item => {
              const status = getItemStatus(item.id)
              const icon = getStatusIcon(status)
              const description = truncateText(item.item_description, 60)

              return (
                <option key={item.id} value={item.id}>
                  {icon} #{item.order_sequence} {description}
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

        {/* Current item info */}
        {activeItem && (
          <div className="mt-2 flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold ${
                  getItemStatus(activeItem.id) === 'good'
                    ? 'bg-green-100 text-green-700'
                    : getItemStatus(activeItem.id) === 'issue'
                    ? 'bg-orange-100 text-orange-700'
                    : getItemStatus(activeItem.id) === 'critical'
                    ? 'bg-red-100 text-red-700'
                    : getItemStatus(activeItem.id) === 'skipped'
                    ? 'bg-blue-100 text-blue-700'
                    : getItemStatus(activeItem.id) === 'not_applicable'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {getStatusIcon(getItemStatus(activeItem.id))}
              </span>
            </div>
            <div className="flex-1 text-xs text-gray-600">
              <div className="font-medium text-gray-900">
                Item #{activeItem.order_sequence}
              </div>
              <div className="line-clamp-2">{activeItem.item_description}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

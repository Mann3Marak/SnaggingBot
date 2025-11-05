"use client"

import { useMemo } from 'react'

// ==================== TYPE DEFINITIONS ====================

export interface StatusCounts {
  good: number
  issue: number
  critical: number
  skipped: number
  notApplicable: number
  pending: number
}

export interface SessionHeaderProps {
  projectName: string
  apartmentNumber: string
  clientName: string
  lastUpdated: Date | string
  counts: StatusCounts
  activeRoomLabel?: string | null
  activeItemLabel?: string | null
  lastUpdatedBy?: string | null
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format timestamp to relative time (e.g., "2 minutes ago") or absolute time
 */
function formatTimestamp(date: Date | string): string {
  const timestamp = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - timestamp.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) {
    return 'just now'
  } else if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  } else {
    // Format as date and time for older timestamps
    return timestamp.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}

/**
 * Format time only (HH:MM)
 */
function formatTime(date: Date | string): string {
  const timestamp = typeof date === 'string' ? new Date(date) : date
  return timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Calculate total completed items (non-pending)
 */
function calculateCompleted(counts: StatusCounts): number {
  return counts.good + counts.issue + counts.critical + counts.skipped + counts.notApplicable
}

/**
 * Calculate total items
 */
function calculateTotal(counts: StatusCounts): number {
  return (
    counts.good +
    counts.issue +
    counts.critical +
    counts.skipped +
    counts.notApplicable +
    counts.pending
  )
}

/**
 * Calculate completion percentage
 */
function calculateProgress(counts: StatusCounts): number {
  const total = calculateTotal(counts)
  if (total === 0) return 0
  const completed = calculateCompleted(counts)
  return Math.round((completed / total) * 100)
}

// ==================== COMPONENT ====================

export function SessionHeader({
  projectName,
  apartmentNumber,
  clientName,
  lastUpdated,
  counts,
  activeRoomLabel,
  activeItemLabel,
  lastUpdatedBy,
}: SessionHeaderProps) {
  const completed = useMemo(() => calculateCompleted(counts), [counts])
  const total = useMemo(() => calculateTotal(counts), [counts])
  const progress = useMemo(() => calculateProgress(counts), [counts])
  const formattedTime = useMemo(() => formatTimestamp(lastUpdated), [lastUpdated])

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-4">
        {/* Top Row: Project Info */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-900">{projectName}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <div className="inline-flex items-center gap-1.5">
                <span className="font-semibold">Apartment:</span>
                <span>{apartmentNumber}</span>
              </div>
              <span className="text-gray-300">•</span>
              <div className="inline-flex items-center gap-1.5">
                <span className="font-semibold">Client:</span>
                <span>{clientName}</span>
              </div>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {completed}/{total}
              </div>
              <div className="text-xs text-gray-500">Items Completed</div>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-gray-200"
                />
                {/* Progress circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                  className="text-blue-500 transition-all duration-300"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-700">{progress}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row: Progress Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {counts.good > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-800 text-xs font-semibold"
              role="status"
              aria-label={`${counts.good} items marked as good`}
            >
              <span aria-hidden="true">✓</span>
              <span>Good: {counts.good}</span>
            </div>
          )}
          {counts.issue > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-100 text-orange-800 text-xs font-semibold"
              role="status"
              aria-label={`${counts.issue} items with issues`}
            >
              <span aria-hidden="true">⚠</span>
              <span>Issue: {counts.issue}</span>
            </div>
          )}
          {counts.critical > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-800 text-xs font-semibold"
              role="status"
              aria-label={`${counts.critical} critical items`}
            >
              <span aria-hidden="true">✗</span>
              <span>Critical: {counts.critical}</span>
            </div>
          )}
          {counts.pending > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold"
              role="status"
              aria-label={`${counts.pending} pending items`}
            >
              <span aria-hidden="true">○</span>
              <span>Pending: {counts.pending}</span>
            </div>
          )}
          {counts.skipped > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-semibold"
              role="status"
              aria-label={`${counts.skipped} skipped items`}
            >
              <span aria-hidden="true">⊘</span>
              <span>Skipped: {counts.skipped}</span>
            </div>
          )}
          {counts.notApplicable > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-semibold"
              role="status"
              aria-label={`${counts.notApplicable} not applicable items`}
            >
              <span aria-hidden="true">−</span>
              <span>N/A: {counts.notApplicable}</span>
            </div>
          )}
        </div>

        {/* Bottom Row: Active Item & Last Updated */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
          {/* Active Item */}
          {activeRoomLabel && activeItemLabel ? (
            <div className="inline-flex items-center gap-2 text-gray-700">
              <span className="font-semibold text-gray-900">Active item:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-blue-700">{activeRoomLabel}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-700">{activeItemLabel}</span>
              </span>
            </div>
          ) : (
            <div className="text-gray-500 italic">No active item selected</div>
          )}

          {/* Last Updated */}
          <div className="inline-flex items-center gap-2 text-gray-600">
            {lastUpdatedBy ? (
              <>
                <span>Updated by</span>
                <span className="font-semibold text-gray-900">{lastUpdatedBy}</span>
                <span>at</span>
                <span className="font-medium">{formatTime(lastUpdated)}</span>
              </>
            ) : (
              <>
                <span>Last updated</span>
                <span className="font-medium text-gray-900">{formattedTime}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

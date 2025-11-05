"use client"

// ==================== TYPE DEFINITIONS ====================

export interface StatusLegendProps {
  compact?: boolean // If true, show in compact horizontal layout
  className?: string
}

// ==================== COMPONENT ====================

export function StatusLegend({ compact = false, className = '' }: StatusLegendProps) {
  const statuses = [
    {
      icon: '✓',
      label: 'Good',
      description: 'Meets NHome standards',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
    },
    {
      icon: '⚠',
      label: 'Issue',
      description: 'Minor defect requiring attention',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-200',
    },
    {
      icon: '✗',
      label: 'Critical',
      description: 'Major defect requiring immediate action',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      borderColor: 'border-red-200',
    },
    {
      icon: '⊘',
      label: 'Skipped',
      description: 'Deferred for later inspection',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
    },
    {
      icon: '−',
      label: 'N/A',
      description: 'Not applicable to this unit',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      borderColor: 'border-gray-200',
    },
    {
      icon: '○',
      label: 'Pending',
      description: 'Not yet inspected',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-400',
      borderColor: 'border-gray-200',
    },
  ]

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>
        {statuses.map((status) => (
          <div
            key={status.label}
            className="inline-flex items-center gap-1.5"
            title={status.description}
          >
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${status.bgColor} ${status.textColor} text-xs font-semibold`}
              aria-hidden="true"
            >
              {status.icon}
            </span>
            <span className="text-xs font-medium text-gray-700">
              {status.label}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Status Legend
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {statuses.map((status) => (
          <div
            key={status.label}
            className={`flex items-start gap-2 p-2 rounded-lg border ${status.borderColor} ${status.bgColor}/30 hover:${status.bgColor}/50 transition-colors`}
          >
            <div className="flex-shrink-0 mt-0.5">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${status.bgColor} ${status.textColor} text-sm font-semibold shadow-sm`}
                aria-hidden="true"
              >
                {status.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${status.textColor}`}>
                {status.label}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                {status.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 italic">
          <strong>Note:</strong> Quality score is calculated from inspected items (Good, Issue, Critical) and excludes Skipped and N/A items.
        </p>
      </div>
    </div>
  )
}

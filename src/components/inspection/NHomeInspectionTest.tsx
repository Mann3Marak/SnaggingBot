"use client"

import { useNHomeInspectionSession } from '@/hooks/useNHomeInspectionSession'
import { useEffect } from 'react'

/**
 * Test Component for useNHomeInspectionSession Hook
 *
 * Purpose: Verify room grouping and active item/room state management
 *
 * Usage: Add this component to a page with a valid session ID to test:
 *   <NHomeInspectionTest sessionId="your-session-id" />
 *
 * Expected Behavior:
 * 1. Checklist items should be grouped by room_type
 * 2. Each room group should have a slugified roomId
 * 3. activeRoomId should update when setActiveItem is called
 * 4. itemToRoomMap should provide quick itemId -> roomId lookups
 * 5. Logs should show the grouped structure in the console
 */
interface NHomeInspectionTestProps {
  sessionId: string
}

export function NHomeInspectionTest({ sessionId }: NHomeInspectionTestProps) {
  const {
    session,
    currentItem,
    currentResult,
    loading,
    nhomeProgress,
    activeRoomId,
    activeItemId,
    roomGroups,
    itemToRoomMap,
    setActiveRoom,
    setActiveItem,
  } = useNHomeInspectionSession(sessionId)

  // Log grouped structure on load
  useEffect(() => {
    if (!loading && roomGroups.length > 0) {
      console.log('========================================')
      console.log('ROOM GROUPING TEST')
      console.log('========================================')
      console.log('Total Rooms:', roomGroups.length)
      console.log('Total Items:', session?.checklist_items?.length ?? 0)
      console.log('')

      roomGroups.forEach((group, index) => {
        console.log(`Room ${index + 1}: ${group.roomLabel} (${group.roomId})`)
        console.log(`  Items: ${group.items.length}`)
        group.items.forEach((item, itemIndex) => {
          console.log(`    ${itemIndex + 1}. ${item.item_description} (order: ${item.order_sequence})`)
        })
        console.log('')
      })

      console.log('========================================')
      console.log('ACTIVE STATE')
      console.log('========================================')
      console.log('Active Room ID:', activeRoomId)
      console.log('Active Item ID:', activeItemId)
      console.log('Current Item:', currentItem ? {
        id: currentItem.id,
        room: currentItem.room_type,
        description: currentItem.item_description,
        sequence: currentItem.order_sequence,
      } : null)
      console.log('Has Result:', Boolean(currentResult))
      if (currentResult) {
        console.log('Result Details:', {
          status: currentResult.status,
          notes: currentResult.notes,
          photos: currentResult.photo_urls?.length ?? 0,
        })
      }
      console.log('')

      console.log('========================================')
      console.log('ITEM TO ROOM MAP')
      console.log('========================================')
      console.log('Map Size:', itemToRoomMap.size)
      const mapEntries: Record<string, string> = {}
      itemToRoomMap.forEach((roomId, itemId) => {
        mapEntries[itemId] = roomId
      })
      console.log('Mappings:', mapEntries)
      console.log('')

      console.log('========================================')
      console.log('PROGRESS & STATUS COUNTS')
      console.log('========================================')
      console.log('Completed:', nhomeProgress.completed, '/', nhomeProgress.total)
      console.log('Good:', nhomeProgress.good)
      console.log('Issue:', nhomeProgress.issue)
      console.log('Critical:', nhomeProgress.critical)
      console.log('Skipped:', nhomeProgress.skipped)
      console.log('Not Applicable:', nhomeProgress.notApplicable)
      console.log('Pending:', nhomeProgress.pending)
      console.log('Quality Score:', nhomeProgress.quality_score, '/ 10')
      console.log('(Score excludes skipped and not_applicable)')
      console.log('========================================')
    }
  }, [loading, roomGroups, activeRoomId, activeItemId, currentItem, currentResult, itemToRoomMap, nhomeProgress, session])

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600">Loading session data...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-8 bg-red-50 rounded-lg">
        <p className="text-red-600">Session not found</p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Room Grouping Test</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold">Session ID:</p>
            <p className="text-gray-600">{sessionId}</p>
          </div>
          <div>
            <p className="font-semibold">Status:</p>
            <p className="text-gray-600">{session.status}</p>
          </div>
          <div>
            <p className="font-semibold">Total Items:</p>
            <p className="text-gray-600">{session.checklist_items?.length ?? 0}</p>
          </div>
          <div>
            <p className="font-semibold">Total Rooms:</p>
            <p className="text-gray-600">{roomGroups.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Active State</h3>
        <div className="space-y-2 text-sm">
          <p><span className="font-semibold">Active Room ID:</span> <span className="text-blue-600">{activeRoomId ?? 'None'}</span></p>
          <p><span className="font-semibold">Active Item ID:</span> <span className="text-blue-600">{activeItemId ?? 'None'}</span></p>
          {currentItem && (
            <div className="mt-4 p-4 bg-blue-50 rounded">
              <p className="font-semibold">Current Item:</p>
              <p className="text-gray-700">{currentItem.room_type} - {currentItem.item_description}</p>
              <p className="text-xs text-gray-500">Order: {currentItem.order_sequence}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Room Groups ({roomGroups.length})</h3>
        <div className="space-y-4">
          {roomGroups.map((group) => (
            <div key={group.roomId} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h4 className="font-bold text-lg">{group.roomLabel}</h4>
                  <p className="text-xs text-gray-500">ID: {group.roomId}</p>
                </div>
                <button
                  onClick={() => setActiveRoom(group.roomId)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Go to Room
                </button>
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2 rounded text-sm cursor-pointer hover:bg-blue-50 ${
                      item.id === activeItemId ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'
                    }`}
                    onClick={() => setActiveItem(item.id)}
                  >
                    <p className="font-medium">{item.item_description}</p>
                    <p className="text-xs text-gray-500">
                      Order: {item.order_sequence} | ID: {item.id.substring(0, 8)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Progress & Status Counts</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="font-semibold">Completed:</span>
            <span className="font-bold">{nhomeProgress.completed} / {nhomeProgress.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-600">✓ Good:</span>
            <span className="font-semibold text-green-600">{nhomeProgress.good}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-600">⚠ Issue:</span>
            <span className="font-semibold text-orange-600">{nhomeProgress.issue}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-red-600">✗ Critical:</span>
            <span className="font-semibold text-red-600">{nhomeProgress.critical}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-600">⊘ Skipped:</span>
            <span className="font-semibold text-blue-600">{nhomeProgress.skipped}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">− N/A:</span>
            <span className="font-semibold text-gray-600">{nhomeProgress.notApplicable}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">○ Pending:</span>
            <span className="font-semibold text-gray-400">{nhomeProgress.pending}</span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="font-semibold">Quality Score:</span>
            <span className="font-bold text-green-600">{nhomeProgress.quality_score} / 10</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            * Score excludes 'skipped' and 'not_applicable' from calculation
          </p>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Test Instructions:</strong> Open browser console to see detailed logs. Click on rooms or items to test navigation.
          Verify that activeRoomId updates automatically when clicking items.
        </p>
      </div>
    </div>
  )
}

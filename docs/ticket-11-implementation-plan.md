# Ticket 11 Implementation Plan

**Goal:** Integrate wireframed layout in NHomeVoiceInspection.tsx

**Status:** IN PROGRESS

**Created:** 2025-11-05

---

## Executive Summary

This ticket integrates all components from Tickets 6-10 into the main inspection interface following the specifications in [inspection-navigation-wireframe.md](./inspection-navigation-wireframe.md).

**Key Changes:**
- Desktop: Three-column layout (RoomNavigator, RoomItemList, VoiceWorkspace)
- Mobile: Single-column with dropdown selectors
- SessionHeader at top
- All voice functionality preserved
- Status legend/tooltips added

---

## Current Implementation Analysis

### Existing File Structure
- **File:** `src/components/inspection/NHomeVoiceInspection.tsx` (1209 lines)
- **Layout:** Single-column, sequential navigation
- **Voice Integration:** Inline with item details
- **Navigation:** Previous/Next buttons only

### Key Functionality to Preserve
1. **Voice Assistant:**
   - Recording toggle
   - STT/TTS integration
   - Transcript display (inspector + assistant)
   - Auto-advance on "moving to next item"
   - Status classification from voice input

2. **Photo Management:**
   - Camera capture modal
   - Local photo storage
   - Upload to Supabase
   - Display photos per item
   - Progress indicators

3. **Status Management:**
   - Good/Issue/Critical buttons
   - Notes textarea for Issue/Critical
   - Auto-save on Good
   - Validation for Issue/Critical (requires notes)

4. **Progress Tracking:**
   - Item count (X of Y)
   - Quality score
   - Issues found count
   - Progress bar

---

## Component Architecture

### New Components Needed

#### 1. VoiceWorkspace Component
**File:** `src/components/inspection/VoiceWorkspace.tsx`

**Purpose:** Extract right panel voice functionality

**Props:**
```typescript
interface VoiceWorkspaceProps {
  sessionId: string
  currentItem: ChecklistItem | null
  isRecording: boolean
  isPlaying: boolean
  onToggleRecording: () => void
  userTranscript: string[]
  assistantTranscript: string[]
  status: string
  activeStatus: string
  lastResponse: string
  onCapturePhoto: () => void
  onNavigatePrevious: () => void
  onNavigateNext: () => void
}
```

**Contains:**
- Voice recording button (center, large, animated)
- Status display
- Inspector transcript panel
- Assistant transcript panel
- Photo capture button
- Navigation buttons (Previous/Next)

#### 2. MobileRoomSelector Component
**File:** `src/components/inspection/MobileRoomSelector.tsx`

**Props:**
```typescript
interface MobileRoomSelectorProps {
  rooms: RoomGroup[]
  activeRoomId: string | null
  onSelectRoom: (roomId: string) => void
}
```

**Implementation:**
```tsx
export function MobileRoomSelector({ rooms, activeRoomId, onSelectRoom }: MobileRoomSelectorProps) {
  const activeRoom = rooms.find(r => r.roomId === activeRoomId)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        ROOM
      </label>
      <select
        value={activeRoomId || ''}
        onChange={(e) => onSelectRoom(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {rooms.map(room => {
          const completed = room.items.filter(/* has result */).length
          return (
            <option key={room.roomId} value={room.roomId}>
              {room.roomLabel} ({completed}/{room.items.length})
            </option>
          )
        })}
      </select>
    </div>
  )
}
```

#### 3. MobileItemSelector Component
**File:** `src/components/inspection/MobileItemSelector.tsx`

**Props:**
```typescript
interface MobileItemSelectorProps {
  items: ChecklistItem[]
  activeItemId: string | null
  onSelectItem: (itemId: string) => void
  results: Map<string, InspectionResult>
}
```

**Implementation:**
```tsx
export function MobileItemSelector({ items, activeItemId, onSelectItem, results }: MobileItemSelectorProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        ITEM
      </label>
      <select
        value={activeItemId || ''}
        onChange={(e) => onSelectItem(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {items.map(item => {
          const result = results.get(item.id)
          const statusIcon = result ? getStatusIcon(result.status) : '○'
          return (
            <option key={item.id} value={item.id}>
              {statusIcon} {item.item_description}
            </option>
          )
        })}
      </select>
    </div>
  )
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'good': return '✓'
    case 'issue': return '⚠'
    case 'critical': return '✗'
    case 'skipped': return '⊘'
    case 'not_applicable': return '−'
    default: return '○'
  }
}
```

#### 4. StatusLegend Component
**File:** `src/components/inspection/StatusLegend.tsx`

**Purpose:** Display color/icon legend as per wireframe Section 6

```tsx
export function StatusLegend() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Legend</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700">✓</span>
          <span>Good</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700">⚠</span>
          <span>Issue</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700">✗</span>
          <span>Critical</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700">⊘</span>
          <span>Skipped</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600">−</span>
          <span>N/A</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400">○</span>
          <span>Pending</span>
        </div>
      </div>
    </div>
  )
}
```

---

## Desktop Layout Implementation

### Grid Structure (≥1024px)

```tsx
// src/components/inspection/NHomeVoiceInspection.tsx

export function NHomeVoiceInspection({ sessionId }: Props) {
  const {
    session,
    currentItem,
    currentResult,
    nhomeProgress,
    activeRoomId,
    activeItemId,
    roomGroups,
    setActiveRoom,
    setActiveItem,
    saveNHomeResult,
    reload
  } = useNHomeInspectionSession(sessionId)

  // Responsive breakpoint detection
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    setIsMobile(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Get active room items
  const activeRoom = roomGroups.find(r => r.roomId === activeRoomId)
  const roomItems = activeRoom?.items ?? []

  // Transform for RoomNavigator
  const roomsForNav = roomGroups.map(group => ({
    roomId: group.roomId,
    label: group.roomLabel,
    counts: {
      // Calculate counts per room from session results
      good: group.items.filter(/* has 'good' result */).length,
      issue: group.items.filter(/* has 'issue' result */).length,
      critical: group.items.filter(/* has 'critical' result */).length,
      skipped: group.items.filter(/* has 'skipped' result */).length,
      notApplicable: group.items.filter(/* has 'not_applicable' result */).length,
      pending: group.items.filter(/* no result */).length,
    }
  }))

  // Transform for RoomItemList
  const itemsForList = roomItems.map(item => ({
    id: item.id,
    label: item.item_description,
    status: getItemStatus(item.id, session?.results), // helper function
    order: item.order_sequence,
  }))

  // Desktop Layout
  if (!isMobile) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Fixed Header */}
        <SessionHeader
          projectName={session?.projects?.name ?? 'Unknown Project'}
          apartmentNumber={session?.apartments?.apartment_number ?? 'N/A'}
          inspectorName={session?.users?.full_name ?? 'Inspector'}
          lastUpdated={session?.updated_at ?? new Date()}
          counts={{
            good: nhomeProgress.good,
            issue: nhomeProgress.issue,
            critical: nhomeProgress.critical,
            skipped: nhomeProgress.skipped,
            notApplicable: nhomeProgress.notApplicable,
            pending: nhomeProgress.pending,
          }}
          activeRoomLabel={activeRoom?.roomLabel ?? null}
          activeItemLabel={currentItem?.item_description ?? null}
        />

        {/* Three-Column Grid */}
        <div className="flex-1 grid grid-cols-[240px_1fr_360px] overflow-hidden">
          {/* Left: Room Navigator */}
          <div className="border-r border-gray-200 bg-white overflow-y-auto">
            <RoomNavigator
              rooms={roomsForNav}
              activeRoomId={activeRoomId}
              onSelectRoom={setActiveRoom}
              searchTerm={searchTerm}
              onSearch={setSearchTerm}
            />
          </div>

          {/* Middle: Item List */}
          <div className="bg-gray-50 overflow-y-auto">
            <RoomItemList
              items={itemsForList}
              activeItemId={activeItemId}
              onSelectItem={setActiveItem}
              onJumpNextPending={handleJumpToPending}
              roomName={activeRoom?.roomLabel}
              counts={roomCounts}
            />
          </div>

          {/* Right: Voice Workspace */}
          <div className="border-l border-gray-200 bg-white overflow-y-auto">
            <VoiceWorkspace
              sessionId={sessionId}
              currentItem={currentItem}
              isRecording={isRecording}
              isPlaying={isPlaying}
              onToggleRecording={handleToggleAssistant}
              userTranscript={userTranscriptSegments}
              assistantTranscript={assistantMessages}
              status={status}
              activeStatus={activeStatus}
              lastResponse={lastResponse}
              onCapturePhoto={() => openNHomeCamera(currentItem?.id)}
              onNavigatePrevious={goToPrevious}
              onNavigateNext={goToNext}
            />
          </div>
        </div>
      </div>
    )
  }

  // Mobile Layout
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Mobile Header */}
      <SessionHeader
        projectName={session?.projects?.name ?? 'Unknown Project'}
        apartmentNumber={session?.apartments?.apartment_number ?? 'N/A'}
        inspectorName={session?.users?.full_name ?? 'Inspector'}
        lastUpdated={session?.updated_at ?? new Date()}
        counts={{
          good: nhomeProgress.good,
          issue: nhomeProgress.issue,
          critical: nhomeProgress.critical,
          skipped: nhomeProgress.skipped,
          notApplicable: nhomeProgress.notApplicable,
          pending: nhomeProgress.pending,
        }}
        activeRoomLabel={activeRoom?.roomLabel ?? null}
        activeItemLabel={currentItem?.item_description ?? null}
      />

      {/* Mobile Content */}
      <div className="p-4 space-y-4">
        {/* Room Selector */}
        <MobileRoomSelector
          rooms={roomGroups}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoom}
        />

        {/* Item Selector */}
        <MobileItemSelector
          items={roomItems}
          activeItemId={activeItemId}
          onSelectItem={setActiveItem}
          results={resultsMap}
        />

        {/* Item Details + Voice Workspace (Stacked) */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {/* Current item display */}
          {/* Status buttons */}
          {/* Voice assistant */}
          {/* Transcripts (collapsible) */}
          {/* Photos */}
        </div>
      </div>
    </div>
  )
}
```

---

## CSS/Tailwind Specifications

### Desktop Grid
```css
.inspection-layout {
  display: grid;
  grid-template-columns: 240px 1fr 360px;
  height: calc(100vh - 80px); /* Adjust based on header height */
  overflow: hidden;
}

.room-navigator {
  overflow-y: auto;
  border-right: 1px solid #e5e7eb;
  background: white;
}

.room-item-list {
  overflow-y: auto;
  background: #f9fafb;
}

.voice-workspace {
  overflow-y: auto;
  border-left: 1px solid #e5e7eb;
  background: white;
  padding: 20px;
}
```

### Mobile Breakpoint
```css
@media (max-width: 1023px) {
  .inspection-layout {
    display: flex;
    flex-direction: column;
  }

  .room-navigator {
    display: none; /* Replaced by dropdown */
  }

  .room-item-list {
    display: none; /* Replaced by dropdown */
  }

  .voice-workspace {
    width: 100%;
    border: none;
  }
}
```

---

## Data Transformation Helpers

### Calculate Room Counts
```typescript
function calculateRoomCounts(room: RoomGroup, results: InspectionResult[]): StatusCounts {
  const counts: StatusCounts = {
    good: 0,
    issue: 0,
    critical: 0,
    skipped: 0,
    notApplicable: 0,
    pending: 0,
  }

  room.items.forEach(item => {
    const result = results.find(r => r.item_id === item.id)
    if (result) {
      switch (result.status) {
        case 'good':
          counts.good++
          break
        case 'issue':
          counts.issue++
          break
        case 'critical':
          counts.critical++
          break
        case 'skipped':
          counts.skipped++
          break
        case 'not_applicable':
          counts.notApplicable++
          break
      }
    } else {
      counts.pending++
    }
  })

  return counts
}
```

### Get Item Status
```typescript
function getItemStatus(
  itemId: string,
  results: InspectionResult[] | undefined
): 'good' | 'issue' | 'critical' | 'skipped' | 'not_applicable' | 'pending' {
  if (!results) return 'pending'
  const result = results.find(r => r.item_id === itemId)
  return result?.status ?? 'pending'
}
```

---

## User Interaction Patterns (from Wireframe Section 7)

### Desktop Interactions

#### Room Selection
**Trigger:** Click room in RoomNavigator
**Behavior:**
1. Update `activeRoomId` via `setActiveRoom(roomId)`
2. RoomItemList automatically updates to show that room's items
3. Highlight selected room (blue background)
4. Maintain scroll position if returning to previously visited room

#### Item Selection
**Trigger:** Click item in RoomItemList
**Behavior:**
1. Update `activeItemId` via `setActiveItem(itemId)`
2. VoiceWorkspace updates to show item details
3. Load existing photos for item
4. Load conversation history for item
5. Highlight selected item (blue left border)

#### Status Button Click
**Trigger:** Click Good/Issue/Critical button
**Behavior:**
- **Good:** Save immediately, advance to next item
- **Issue/Critical:** Show notes textarea, require input before saving
- Call `saveNHomeResult(itemId, status, notes, priority, photos, shouldAdvance)`

### Mobile Interactions

#### Room Selection
**Trigger:** Change room dropdown
**Behavior:**
1. Update `activeRoomId`
2. Load items for that room into item dropdown
3. Auto-select first item in room

#### Item Selection
**Trigger:** Change item dropdown
**Behavior:**
1. Update `activeItemId`
2. Load item details into main content area
3. Expand/scroll to show status buttons

---

## Testing Checklist

### Desktop Layout (≥1024px)

- [ ] **SessionHeader displays correctly**
  - Project name, apartment number, inspector name
  - Progress ring shows correct percentage
  - Status chips show correct counts
  - Active item displays "Room • Item"
  - Last updated shows relative time

- [ ] **RoomNavigator (Left Sidebar)**
  - All rooms display with correct names
  - Room status icons correct (✓ ⚠ ◐ ○)
  - Room counts accurate
  - Click room updates middle panel
  - Active room has blue background
  - Search filters rooms correctly

- [ ] **RoomItemList (Middle Column)**
  - Items display for active room only
  - Item order matches order_sequence
  - Status badges correct
  - Active item has blue left border
  - Click item updates voice workspace
  - "Jump to next pending" button works
  - Scroll works independently

- [ ] **VoiceWorkspace (Right Panel)**
  - Voice recording toggle works
  - Transcripts display correctly
  - Status display updates
  - Photo capture button opens modal
  - Navigation buttons work (Previous/Next)
  - Scroll works independently

- [ ] **Three-column grid behavior**
  - Columns maintain fixed widths (240px, flex, 360px)
  - Each column scrolls independently
  - No horizontal scroll on full screen
  - Borders between columns visible

### Mobile Layout (<1024px)

- [ ] **SessionHeader displays correctly**
  - Stacks vertically
  - All info readable
  - Progress ring visible

- [ ] **MobileRoomSelector**
  - Dropdown shows all rooms
  - Shows completion count per room
  - Selection updates content

- [ ] **MobileItemSelector**
  - Dropdown shows all items in room
  - Shows status icon per item
  - Selection updates content

- [ ] **Content Area**
  - Item details display
  - Status buttons accessible
  - Voice assistant section works
  - Transcripts collapsible
  - Photos section works
  - Navigation buttons work

- [ ] **Responsive behavior**
  - Layout switches at 1024px
  - No content overflow
  - Touch targets adequate (44px min)

### Functionality Preservation

- [ ] **Voice Assistant**
  - Recording starts/stops correctly
  - STT transcription appears
  - Agent API called
  - TTS playback works
  - Auto-advance on "moving to next item"

- [ ] **Status Classification**
  - Voice input classified correctly
  - Agent reply classified correctly
  - Pending status updates correctly
  - Notes extracted from agent reply

- [ ] **Photo Management**
  - Camera modal opens
  - Photos captured
  - Photos uploaded to Supabase
  - Photos display per item
  - Photos persist after navigation

- [ ] **Progress Tracking**
  - Item count updates
  - Quality score updates
  - Issues count updates
  - Progress bar reflects completion

### Integration Tests

- [ ] **Room Navigation**
  - Navigate from room to room
  - Items update correctly
  - Active item preserved within room
  - No data loss

- [ ] **Item Navigation**
  - Navigate item to item
  - Data saved correctly
  - Photos preserved
  - Transcripts preserved

- [ ] **Status Saving**
  - Good status saves and advances
  - Issue requires notes
  - Critical requires notes
  - Validation works

- [ ] **URL State**
  - URL reflects current room/item
  - Deep link works (direct URL access)
  - Browser back/forward works

### Performance

- [ ] **Initial Load**
  - Page loads in <3 seconds
  - No layout shifts
  - Smooth transitions

- [ ] **Navigation**
  - Room switch <200ms
  - Item switch <100ms
  - No janky scrolling

- [ ] **Voice Processing**
  - STT response <2 seconds
  - TTS playback starts immediately
  - No audio glitches

---

## Migration Strategy

### Phase 1: Create New Components (DONE)
- ✅ SessionHeader (Ticket 10)
- ✅ RoomNavigator (Ticket 8)
- ✅ RoomItemList (Ticket 9)
- ⏳ VoiceWorkspace (Extract from existing code)
- ⏳ MobileRoomSelector (Create new)
- ⏳ MobileItemSelector (Create new)
- ⏳ StatusLegend (Create new)

### Phase 2: Create Integrated Layout (IN PROGRESS)
- ⏳ Update NHomeVoiceInspection.tsx with new layout
- ⏳ Wire up all component props
- ⏳ Implement responsive breakpoint
- ⏳ Add mobile dropdowns

### Phase 3: Testing (PENDING)
- [ ] Manual testing on desktop
- [ ] Manual testing on mobile
- [ ] Browser compatibility testing
- [ ] Performance testing
- [ ] Accessibility audit

### Phase 4: Deployment (PENDING)
- [ ] QA approval
- [ ] Stakeholder demo
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

---

## Known Issues / Edge Cases

### To Handle
1. **Empty room** - What if a room has 0 items?
2. **Completed inspection** - How to handle when all items done?
3. **Session reload** - Preserve active room/item on page refresh
4. **Concurrent users** - Real-time updates if multiple inspectors
5. **Offline mode** - Queue actions when network unavailable
6. **Large item lists** - Virtual scrolling for 50+ items per room?

### Resolved
- ✅ Photo URLs from `currentResult` not `currentItem`
- ✅ Status counts include all 6 statuses (not just 3)
- ✅ Active item ID vs current item index

---

## File Structure

```
src/components/inspection/
├── NHomeVoiceInspection.tsx         # Main integrated layout
├── SessionHeader.tsx                # ✅ Ticket 10
├── RoomNavigator.tsx                # ✅ Ticket 8
├── RoomItemList.tsx                 # ✅ Ticket 9
├── VoiceWorkspace.tsx               # ⏳ Extract
├── MobileRoomSelector.tsx           # ⏳ Create
├── MobileItemSelector.tsx           # ⏳ Create
├── StatusLegend.tsx                 # ⏳ Create
└── NHomeInspectionTest.tsx          # Test component

docs/
├── inspection-navigation-wireframe.md  # ✅ Wireframe spec
├── ticket-11-implementation-plan.md    # ✅ This document
└── ticket-11-qa-log.md                 # ⏳ QA checklist

```

---

## Next Steps

1. **Extract VoiceWorkspace component** from existing code
2. **Create mobile selector components** (MobileRoomSelector, MobileItemSelector)
3. **Update NHomeVoiceInspection.tsx** with integrated layout
4. **Test desktop layout** against wireframe spec
5. **Test mobile layout** on actual devices
6. **Create QA log** with test results
7. **Deploy to staging** for user acceptance testing

---

**Status:** ⏳ IN PROGRESS

**Blocked By:** None

**Next Action:** Extract VoiceWorkspace component

**Estimated Completion:** 2025-11-06

---

**End of Document**

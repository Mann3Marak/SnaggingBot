# NHome Inspection Navigation - Wireframe & Layout Specifications

**Document Version:** 1.0
**Created:** 2025-11-04
**Status:** DRAFT - Awaiting Stakeholder Approval
**Dependencies:** Ticket 1 (inspection-data-flow.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Desktop Layout Wireframe](#desktop-layout-wireframe)
3. [Mobile Layout Wireframe](#mobile-layout-wireframe)
4. [Component Architecture](#component-architecture)
5. [Responsive Breakpoints](#responsive-breakpoints)
6. [Color Cues & Iconography](#color-cues--iconography)
7. [User Interaction Patterns](#user-interaction-patterns)
8. [Technical Implementation Notes](#technical-implementation-notes)
9. [Stakeholder Approval](#stakeholder-approval)

---

## Executive Summary

This document outlines the proposed redesign of the NHome Inspection interface from a **single-column, linear layout** to a **multi-column, room-based navigation system**.

### Current State
- Linear, single-column UI requiring sequential navigation (Previous/Next buttons)
- No room grouping or overview
- Progress tracked only by item count (e.g., "47 of 107")
- Voice assistant integrated inline with status buttons

### Proposed State
- **Desktop:** 3-column layout with room sidebar, item list, and voice workspace
- **Mobile:** Dropdown-based navigation with collapsible sections
- Room-based progress tracking
- Enhanced spatial awareness of inspection scope

### Key Benefits
1. **Improved Navigation:** Jump directly to any room or item
2. **Better Context:** See all rooms and their completion status at a glance
3. **Reduced Cognitive Load:** Room grouping mirrors physical space
4. **Enhanced UX:** Persistent voice workspace alongside inspection flow

---

## Desktop Layout Wireframe

### Full Desktop Layout (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           HEADER (Fixed Top)                                      │
│  ┌────────────┐  NHome Professional Inspection                Unit A-301         │
│  │  NHome     │  Project: Quinta do Lago Residences            T3 Apartment      │
│  │  Logo      │  Inspector: Natalie O'Kelly                    Quality: 8.5/10   │
│  └────────────┘                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┬────────────────────────────────┬──────────────────────────────┐
│  ROOM SIDEBAR   │    ITEM LIST (Middle)          │   VOICE WORKSPACE (Right)    │
│  (Left Panel)   │                                │                              │
│  Width: 240px   │    Width: Flexible             │   Width: 360px               │
│                 │                                │                              │
│ ┌─────────────┐ │ ┌────────────────────────────┐ │ ┌──────────────────────────┐ │
│ │ ENTRADA     │ │ │ Current Item: Kitchen       │ │ │ Voice Assistant Status   │ │
│ │ ✓ 8/8 items │ │ │                            │ │ │ [●] Recording...         │ │
│ └─────────────┘ │ │ ┏━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │ │                          │ │
│                 │ │ ┃ Check kitchen cabinets  ┃ │ │ │ [Microphone Icon]        │ │
│ ┌─────────────┐ │ │ ┃ and drawers            ┃ │ │ │ "Tap to start/stop"      │ │
│ │ SALA        │ │ │ ┗━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │ └──────────────────────────┘ │
│ │ ⚠ 6/12 items│ │ │                            │ │                              │
│ └─────────────┘ │ │ NHome Standard:            │ │ ┌──────────────────────────┐ │
│                 │ │ Cabinet doors must close   │ │ │ Inspector Transcript     │ │
│ ┌─────────────┐ │ │ flush without gaps...      │ │ │                          │ │
│ │►COZINHA     │ │ │                            │ │ │ "The cabinet door is     │ │
│ │ ◐ 3/15 items│ │ │ ┌──────┐ ┌──────┐ ┌──────┐│ │ │  scratched on the lower  │ │
│ └─────────────┘ │ │ │ Good │ │Issue │ │Crit. ││ │ │  left corner"            │ │
│                 │ │ └──────┘ └──────┘ └──────┘│ │ │                          │ │
│ ┌─────────────┐ │ │                            │ │ └──────────────────────────┘ │
│ │ QUARTO 1    │ │ │ [Issue/Critical Notes Box] │ │                              │
│ │ ○ 0/18 items│ │ │ [Visible when Issue/Crit.] │ │ ┌──────────────────────────┐ │
│ └─────────────┘ │ │                            │ │ │ Assistant Response       │ │
│                 │ │ ━━━━━━━━━━━━━━━━━━━━━━━━━ │ │ │                          │ │
│ ┌─────────────┐ │ │ Progress: ████░░░░ 47/107  │ │ │ "I've documented:        │ │
│ │ QUARTO 2    │ │ │                            │ │ │ Minor scratch damage on  │ │
│ │ ○ 0/18 items│ │ │ ━━━━━━━━━━━━━━━━━━━━━━━━━ │ │ │ lower left cabinet door. │ │
│ └─────────────┘ │ │                            │ │ │ Moving to next item..."  │ │
│                 │ │ ┌───────────────────────┐  │ │ │                          │ │
│ ┌─────────────┐ │ │ │ Kitchen Cabinets      │  │ │ └──────────────────────────┘ │
│ │ QUARTO 3    │ │ │ │ [✓] Status: Issue     │  │ │                              │
│ │ ○ 0/18 items│ │ │ │ Notes: Scratch damage │  │ │ ┌──────────────────────────┐ │
│ └─────────────┘ │ │ │ Photos: 2 attached    │  │ │ │ [📷 Capture Photo]       │ │
│                 │ │ │                       │  │ │ │                          │ │
│ ┌─────────────┐ │ │ └───────────────────────┘  │ │ │ Photos (3):              │ │
│ │ CASA BANHO 1│ │ │                            │ │ │ [thumb][thumb][thumb]    │ │
│ │ ○ 0/14 items│ │ │ ┌───────────────────────┐  │ │ └──────────────────────────┘ │
│ └─────────────┘ │ │ │ Kitchen Sink & Taps   │  │ │                              │
│                 │ │ │ [○] Not inspected yet │  │ │ [← Prev Item] [Next Item →] │
│ ┌─────────────┐ │ │ │                       │  │ │                              │
│ │ CASA BANHO 2│ │ │ └───────────────────────┘  │ │                              │
│ │ ○ 0/14 items│ │ │                            │ │                              │
│ └─────────────┘ │ │ ┌───────────────────────┐  │ │                              │
│                 │ │ │ Kitchen Countertops   │  │ │                              │
│                 │ │ │ [○] Not inspected yet │  │ │                              │
│                 │ │ │                       │  │ │                              │
│                 │ │ └───────────────────────┘  │ │                              │
│                 │ │                            │ │                              │
│                 │ │ [Scroll for more items...] │ │                              │
│                 │ │                            │ │                              │
└─────────────────┴────────────────────────────────┴──────────────────────────────┘
```

### Component Breakdown

#### Left Sidebar: `<RoomNavigator>`
- **Purpose:** Display all rooms with completion status
- **Width:** 240px fixed
- **Scrollable:** Yes (vertical scroll if room list exceeds viewport)
- **Interactions:** Click room to jump to its item list

#### Middle Column: `<RoomItemList>`
- **Purpose:** Show all checklist items for current room
- **Width:** Flexible (fills remaining space)
- **Scrollable:** Yes (vertical scroll)
- **Interactions:**
  - Click item card to expand/inspect
  - Status buttons (Good/Issue/Critical)
  - Add notes for Issue/Critical items

#### Right Workspace: `<VoiceWorkspace>`
- **Purpose:** Persistent voice assistant and photo capture
- **Width:** 360px fixed
- **Scrollable:** Yes (for long transcripts)
- **Interactions:**
  - Voice recording toggle
  - View transcripts (inspector + assistant)
  - Capture photos
  - Navigate between items

---

## Mobile Layout Wireframe

### Mobile/Tablet Layout (<1024px)

```
┌──────────────────────────────────────┐
│           MOBILE HEADER              │
│  ┌────┐  NHome Inspection            │
│  │Logo│  Unit A-301 | T3             │
│  └────┘  47/107 items | Score: 8.5   │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  ▼ ROOM: Cozinha (Kitchen)    3/15 ✓ │  ← Dropdown Selector
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  ▼ ITEM: Kitchen Cabinets       [✓]  │  ← Dropdown Selector
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Check kitchen cabinets and     │  │
│  │ drawers for proper closure     │  │
│  └────────────────────────────────┘  │
│                                      │
│  NHome Standard:                     │
│  Cabinet doors must close flush...   │
│                                      │
│  ┌────────┐ ┌────────┐ ┌──────────┐ │
│  │  Good  │ │ Issue  │ │ Critical │ │
│  └────────┘ └────────┘ └──────────┘ │
│                                      │
│  [Issue/Critical Notes - Expandable] │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                      │
│  Voice Assistant                     │
│  ┌────────────────────────────────┐  │
│  │ [●] Recording...               │  │
│  │                                │  │
│  │      [Microphone Icon]         │  │
│  │      "Tap to start/stop"       │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  ▼ Inspector Transcript (Collapsible)│
│  ▼ Assistant Transcript (Collapsible)│
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                      │
│  Photos                              │
│  [📷 Capture] [thumb] [thumb]        │
│                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                      │
│  Progress: ████░░░░ 47/107           │
│                                      │
│  [← Previous]     [Next Item →]      │
│                                      │
└──────────────────────────────────────┘
```

### Mobile Component Breakdown

#### `<MobileRoomSelector>`
- **Type:** Dropdown/Select component
- **Purpose:** Replace left sidebar with compact room selector
- **Shows:** Room name + completion count (e.g., "Cozinha 3/15")
- **Interactions:** Tap to open dropdown, select room

#### `<MobileItemSelector>`
- **Type:** Dropdown/Select component
- **Purpose:** Replace middle column item list with compact item selector
- **Shows:** Item description + status icon
- **Interactions:** Tap to open dropdown, select item

#### `<MobileInspectionWorkspace>`
- **Type:** Vertically stacked, scrollable container
- **Contains:**
  - Item details (expanded)
  - Status buttons
  - Voice assistant (collapsible)
  - Transcripts (collapsible)
  - Photo section
  - Navigation buttons

---

## Component Architecture

### 1. `<RoomNavigator>` (Desktop Left Sidebar)

**Purpose:** Displays room list with visual progress indicators

**Props:**
```typescript
interface RoomNavigatorProps {
  rooms: Room[]
  currentRoomId: string
  onRoomSelect: (roomId: string) => void
}

interface Room {
  id: string
  name: string
  name_pt?: string
  totalItems: number
  completedItems: number
  issueCount: number
  criticalCount: number
}
```

**State:**
- `selectedRoomId: string` - Currently active room
- `hoveredRoomId: string | null` - For hover effects

**Visual Indicators:**
- ✓ Checkmark: All items completed (green)
- ⚠ Warning: Items with issues/critical (yellow/red)
- ◐ Half-circle: Partially completed (blue)
- ○ Empty circle: Not started (gray)

**Responsibilities:**
1. Render list of rooms grouped by apartment type
2. Display completion percentage per room
3. Highlight current room
4. Handle room selection clicks
5. Show visual cues for issues/critical items

**Example Implementation:**
```typescript
// Located at: src/components/inspection/RoomNavigator.tsx
export function RoomNavigator({ rooms, currentRoomId, onRoomSelect }: RoomNavigatorProps) {
  return (
    <aside className="w-60 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Inspection Rooms
        </h2>
        <ul className="space-y-2">
          {rooms.map(room => (
            <RoomNavigatorItem
              key={room.id}
              room={room}
              isActive={room.id === currentRoomId}
              onClick={() => onRoomSelect(room.id)}
            />
          ))}
        </ul>
      </div>
    </aside>
  )
}
```

---

### 2. `<RoomItemList>` (Desktop Middle Column)

**Purpose:** Displays checklist items for current room

**Props:**
```typescript
interface RoomItemListProps {
  roomId: string
  items: ChecklistItem[]
  currentItemId: string
  sessionId: string
  onItemSelect: (itemId: string) => void
  onStatusUpdate: (itemId: string, status: InspectionStatus, notes: string) => void
}

interface ChecklistItem {
  id: string
  room_type: string
  item_description: string
  item_description_pt?: string
  order_sequence: number
  nhome_standard_notes?: string
  inspectionResult?: InspectionResult | null
}

interface InspectionResult {
  status: 'good' | 'issue' | 'critical'
  notes?: string
  photo_urls?: string[]
  created_at: string
}
```

**State:**
- `expandedItemId: string | null` - Which item card is expanded
- `showNotesFor: string | null` - Which item is showing notes input

**Responsibilities:**
1. Render all items for selected room
2. Display item description and NHome standards
3. Show status buttons (Good/Issue/Critical)
4. Handle notes input for Issue/Critical items
5. Display existing inspection results
6. Show photo thumbnails
7. Highlight current item being inspected

**Visual States:**
- **Not inspected:** Gray card, empty status
- **Good:** Green checkmark badge
- **Issue:** Yellow warning badge
- **Critical:** Red alert badge

---

### 3. `<VoiceWorkspace>` (Desktop Right Panel)

**Purpose:** Persistent voice assistant and photo management

**Props:**
```typescript
interface VoiceWorkspaceProps {
  sessionId: string
  currentItem: ChecklistItem | null
  isRecording: boolean
  onToggleRecording: () => void
  userTranscript: string[]
  assistantTranscript: string[]
  photos: Photo[]
  onCapturePhoto: () => void
  onRemovePhoto: (photoId: string) => void
}
```

**State:**
- `isRecording: boolean`
- `isPlaying: boolean`
- `transcriptExpanded: boolean`

**Responsibilities:**
1. Display voice assistant status (Idle/Recording/Playing)
2. Show microphone button with visual feedback
3. Render inspector transcript
4. Render assistant transcript
5. Display photo grid for current item
6. Handle photo capture and removal
7. Show navigation controls (Previous/Next)

**Sub-components:**
- `<VoiceRecordButton>` - Microphone toggle with animation
- `<TranscriptPanel>` - Collapsible transcript display
- `<PhotoGrid>` - Photo thumbnails with upload status

---

### 4. `<MobileRoomSelector>` (Mobile)

**Purpose:** Dropdown replacement for desktop room sidebar

**Props:**
```typescript
interface MobileRoomSelectorProps {
  rooms: Room[]
  currentRoomId: string
  onRoomChange: (roomId: string) => void
}
```

**Responsibilities:**
1. Render native `<select>` or custom dropdown
2. Show current room name and progress
3. Handle room selection
4. Display completion indicators in dropdown options

---

### 5. `<MobileItemSelector>` (Mobile)

**Purpose:** Dropdown replacement for desktop item list

**Props:**
```typescript
interface MobileItemSelectorProps {
  items: ChecklistItem[]
  currentItemId: string
  onItemChange: (itemId: string) => void
}
```

**Responsibilities:**
1. Render native `<select>` or custom dropdown
2. Show current item description (truncated)
3. Display status icon in dropdown options
4. Handle item selection

---

### 6. `<InspectionProgressBar>`

**Purpose:** Visual progress indicator (used in both layouts)

**Props:**
```typescript
interface InspectionProgressBarProps {
  completed: number
  total: number
  issuesFound: number
  qualityScore: number
}
```

**Responsibilities:**
1. Display progress bar (completed/total)
2. Show quality score
3. Show issues found count
4. Update in real-time as items are inspected

---

## Responsive Breakpoints

### Breakpoint Strategy

| Breakpoint | Width Range | Layout Mode | Key Changes |
|------------|-------------|-------------|-------------|
| **Mobile** | 0 - 767px | Single Column | Dropdowns replace sidebars, collapsible sections |
| **Tablet** | 768px - 1023px | Hybrid | Optional: 2-column (items + voice workspace), dropdown room selector |
| **Desktop** | 1024px+ | Three Column | Full sidebar layout with room list, items, and voice workspace |
| **Large Desktop** | 1440px+ | Three Column Enhanced | Wider panels, larger font sizes, more whitespace |

### Responsive Behavior

#### Mobile (<768px)
```css
.inspection-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
}

.room-navigator { display: none; } /* Hidden, replaced by dropdown */
.room-item-list { display: none; } /* Hidden, replaced by dropdown */
.voice-workspace { width: 100%; }
```

#### Tablet (768px - 1023px)
**Option A:** Keep mobile dropdown layout with larger touch targets
**Option B:** Show 2 columns (items list + voice workspace), room dropdown at top

```css
.inspection-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
}

.room-navigator { display: none; } /* Still dropdown */
.room-item-list { display: block; } /* Show as column */
.voice-workspace { width: 360px; }
```

#### Desktop (≥1024px)
```css
.inspection-layout {
  display: grid;
  grid-template-columns: 240px 1fr 360px;
  gap: 0;
  height: calc(100vh - 80px); /* Full viewport minus header */
}

.room-navigator {
  display: block;
  overflow-y: auto;
  border-right: 1px solid #e5e7eb;
}

.room-item-list {
  display: block;
  overflow-y: auto;
  padding: 24px;
}

.voice-workspace {
  display: block;
  overflow-y: auto;
  border-left: 1px solid #e5e7eb;
  padding: 20px;
}
```

### Responsive Component Mounting

```typescript
// src/components/inspection/NHomeVoiceInspectionV2.tsx

export function NHomeVoiceInspectionV2({ sessionId }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    setIsMobile(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  if (isMobile) {
    return (
      <MobileInspectionLayout
        sessionId={sessionId}
        rooms={rooms}
        items={items}
        // ... props
      />
    )
  }

  return (
    <DesktopInspectionLayout
      sessionId={sessionId}
      rooms={rooms}
      items={items}
      // ... props
    />
  )
}
```

---

## Color Cues & Iconography

### Color Palette

#### Status Colors
```css
/* Primary Brand Colors */
--nhome-primary: #1e3a8a;      /* Dark blue */
--nhome-secondary: #0ea5e9;    /* Cyan blue */
--nhome-accent: #06b6d4;       /* Teal */

/* Status Colors */
--status-good: #10b981;        /* Green */
--status-issue: #f59e0b;       /* Amber/Orange */
--status-critical: #ef4444;    /* Red */
--status-pending: #6b7280;     /* Gray */

/* Background Colors */
--bg-primary: #ffffff;         /* White */
--bg-secondary: #f9fafb;       /* Light gray */
--bg-hover: #f3f4f6;           /* Hover state gray */
--bg-selected: #dbeafe;        /* Light blue (selected room) */

/* Text Colors */
--text-primary: #111827;       /* Dark gray/black */
--text-secondary: #6b7280;     /* Medium gray */
--text-muted: #9ca3af;         /* Light gray */
```

### Room Status Icons

| Icon | Unicode | Meaning | Color |
|------|---------|---------|-------|
| ✓ | U+2713 | All items completed | Green (#10b981) |
| ⚠ | U+26A0 | Has issues or critical items | Yellow/Red (#f59e0b / #ef4444) |
| ◐ | U+25D0 | Partially completed | Blue (#0ea5e9) |
| ○ | U+25CB | Not started | Gray (#6b7280) |

### Item Status Badges

**Good:**
```html
<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
  ✓ Good
</span>
```

**Issue:**
```html
<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
  ⚠ Issue
</span>
```

**Critical:**
```html
<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
  ⚠ Critical
</span>
```

### Iconography Set

**Core Icons (Material Design or Heroicons):**
- **Microphone:** Voice recording
- **Camera:** Photo capture
- **CheckCircle:** Good status
- **ExclamationTriangle:** Issue/Critical
- **ChevronRight:** Navigate forward
- **ChevronLeft:** Navigate backward
- **ChevronDown:** Expand dropdown/section
- **ClipboardList:** Checklist/Items
- **Home:** Rooms/Navigation
- **DocumentText:** Notes
- **Photo:** Photos/Gallery

**SVG Icon Example (Microphone):**
```html
<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
</svg>
```

---

## User Interaction Patterns

### Desktop Interactions

#### 1. Room Selection
**Trigger:** Click room in left sidebar
**Behavior:**
1. Highlight selected room (blue background)
2. Load items for that room in middle column
3. Scroll middle column to top
4. Maintain current item index within that room if returning

#### 2. Item Inspection
**Trigger:** Click item card in middle column
**Behavior:**
1. Expand item card (if collapsed)
2. Update voice workspace with item details
3. Load existing photos for that item
4. Load conversation history for that item
5. Update URL/state: `?room=cozinha&item=kitchen-cabinets`

#### 3. Status Selection
**Trigger:** Click Good/Issue/Critical button
**Behavior:**
- **Good:** Immediately save result, advance to next item
- **Issue/Critical:** Show notes textarea, require text input before saving

#### 4. Voice Recording
**Trigger:** Click microphone button
**Behavior:**
1. Request microphone permission (if first time)
2. Start recording (show pulsing red indicator)
3. Send audio to STT when stopped
4. Display transcript in real-time
5. Send transcript to agent API
6. Play TTS response

### Mobile Interactions

#### 1. Room Selection
**Trigger:** Tap room dropdown
**Behavior:**
1. Open native select or custom modal with room list
2. Show completion percentage in each option
3. On selection: load items for that room, update item dropdown

#### 2. Item Selection
**Trigger:** Tap item dropdown
**Behavior:**
1. Open native select or custom modal with item list
2. Show status icon next to each item
3. On selection: load item details, collapse sections for easier scrolling

#### 3. Collapsible Sections
**Mobile-specific:** Transcripts, photo grid, notes sections are collapsible
**Trigger:** Tap section header with chevron icon
**Behavior:** Toggle section visibility to reduce scrolling

---

## Technical Implementation Notes

### Data Fetching Strategy

#### On Page Load
1. Fetch inspection session with apartment and project details
2. Fetch all checklist templates for apartment type
3. Fetch all inspection results for session
4. Group items by room_type
5. Calculate room-level progress

**Query Example:**
```typescript
// src/hooks/useNHomeInspectionSessionV2.ts
const { data: sessionData } = await supabase
  .from('inspection_sessions')
  .select(`
    *,
    apartments:apartment_id (
      *,
      projects (*)
    ),
    checklist_templates!inner (
      id,
      room_type,
      item_description,
      item_description_pt,
      order_sequence,
      nhome_standard_notes
    ),
    inspection_results (
      id,
      item_id,
      status,
      notes,
      photo_urls,
      created_at
    )
  `)
  .eq('id', sessionId)
  .single()

// Group items by room
const roomsMap = sessionData.checklist_templates.reduce((acc, item) => {
  if (!acc[item.room_type]) {
    acc[item.room_type] = { name: item.room_type, items: [] }
  }
  acc[item.room_type].items.push(item)
  return acc
}, {} as Record<string, Room>)

// Calculate completion per room
const rooms = Object.entries(roomsMap).map(([roomName, roomData]) => {
  const completedItems = roomData.items.filter(item =>
    sessionData.inspection_results.some(r => r.item_id === item.id)
  )
  return {
    id: roomName,
    name: roomName,
    totalItems: roomData.items.length,
    completedItems: completedItems.length,
    items: roomData.items
  }
})
```

### State Management

**Recommended: Zustand or Context API**

```typescript
// src/store/inspectionStore.ts
interface InspectionStore {
  sessionId: string
  rooms: Room[]
  currentRoomId: string
  currentItemId: string
  inspectionResults: Map<string, InspectionResult>

  setCurrentRoom: (roomId: string) => void
  setCurrentItem: (itemId: string) => void
  saveResult: (itemId: string, result: InspectionResult) => Promise<void>
  updateProgress: () => void
}
```

### URL State Management

**Deep linking for direct access to specific rooms/items:**
```
/inspections/[sessionId]?room=cozinha&item=abc-123
```

```typescript
const router = useRouter()
const searchParams = useSearchParams()

// Read from URL
const roomId = searchParams.get('room') || rooms[0]?.id
const itemId = searchParams.get('item') || rooms[0]?.items[0]?.id

// Update URL on navigation
const navigateToItem = (roomId: string, itemId: string) => {
  router.push(`/inspections/${sessionId}?room=${roomId}&item=${itemId}`, { scroll: false })
}
```

### Performance Considerations

1. **Virtualized Lists:** Use `react-window` or `@tanstack/react-virtual` for long item lists (>50 items)
2. **Lazy Loading:** Load photos on-demand, not all at once
3. **Debounced Notes:** Auto-save notes input after 2 seconds of inactivity
4. **Memoization:** Memoize room progress calculations with `useMemo`
5. **Optimistic Updates:** Update UI immediately, sync to database in background

---

## Stakeholder Approval

### Approval Section

**Reviewers:** Product Owner, Design Lead, Technical Lead
**Review Period:** 7 days (2025-11-04 to 2025-11-11)
**Feedback Method:** GitHub issues or inline comments in this document

### Approval Checklist

- [ ] **Product Owner:** Natalie O'Kelly - Approved on __________ by __________
- [ ] **Design Lead:** __________ - Approved on __________ by __________
- [ ] **Technical Lead:** __________ - Approved on __________ by __________

### Feedback Log

| Date | Reviewer | Feedback | Resolution |
|------|----------|----------|------------|
| YYYY-MM-DD | Name | Description of feedback or concern | How it was addressed |
|  |  |  |  |

### Final Approval

**Status:** ⏳ AWAITING APPROVAL

Once all reviewers have signed off, update status to:
**Status:** ✅ APPROVED on YYYY-MM-DD

**Implementation Ticket:** Link to Jira/Linear/GitHub issue once approved

---

## Appendix: Comparison with Current Implementation

### Current Implementation Location
- File: `src/components/inspection/NHomeVoiceInspection.tsx`
- Lines: 818-1196 (main UI render)
- Layout: Single column, sequential navigation

### Key Changes Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Navigation** | Previous/Next buttons only | Room sidebar + item list (desktop), dropdowns (mobile) |
| **Room Context** | Hidden (only see current item) | Always visible (desktop sidebar, mobile dropdown) |
| **Progress Tracking** | Global item count (e.g., 47/107) | Per-room progress + global progress |
| **Voice Assistant** | Inline with item details | Persistent right panel (desktop), collapsible (mobile) |
| **Photo Management** | Below transcripts | Dedicated section in voice workspace |
| **Item Overview** | None (must navigate to see other items) | Middle column shows all items in current room |

### Migration Path

**Phase 1: Component Refactoring**
1. Extract existing UI logic into smaller components
2. Create `<RoomNavigator>`, `<RoomItemList>`, `<VoiceWorkspace>` as separate files
3. Maintain backward compatibility with current layout

**Phase 2: Layout Implementation**
1. Implement desktop 3-column grid layout
2. Wire up room selection and item filtering
3. Test with existing data

**Phase 3: Mobile Responsive**
1. Add mobile dropdown selectors
2. Implement collapsible sections
3. Test on various mobile devices

**Phase 4: Polish & Launch**
1. Add animations and transitions
2. Performance optimization
3. User acceptance testing
4. Deploy to production

---

**End of Document**

---

## Document Metadata

**Author:** Claude (AI Assistant)
**Last Updated:** 2025-11-04
**Version:** 1.0 DRAFT
**Next Review:** After stakeholder feedback
**Related Documents:**
- [Inspection Data Flow](./inspection-data-flow.md)
- [Component API Reference](#) (TBD)
- [Figma Mock Link](#) (TBD)

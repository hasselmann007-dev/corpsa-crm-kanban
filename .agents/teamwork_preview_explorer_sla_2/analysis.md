# Technical Analysis & Implementation Design: Requirement R2 (Floating Pendências SLA)

## Executive Summary
This document provides a comprehensive investigation of how Floating Pendências (Sticky Notes / Pending items) are structured, stored in `LocalStorage`, created, rendered, and managed in `src/App.tsx`. It details the existing architecture, formulates a migration strategy for missing `createdAt` ISO timestamps, and recommends exact code locations and logic to satisfy **Requirement R2** (displaying a static `"SLA Atrasada"` warning badge for pending items remaining uncompleted after 2 hours / 120 minutes).

---

## 1. Storage & Data Structure in LocalStorage

### 1.1 LocalStorage Key Names
All state related to the floating pendências widget is persisted in `window.localStorage` under key names prefixed with `widget_pendencias_`:

| Key Name | Type / Format | Purpose |
|---|---|---|
| `widget_pendencias_items` | JSON String (`StickyNote[]`) | Stores the array of pending items |
| `widget_pendencias_visible` | String (`"true"` \| `"false"`) | Controls widget visibility state |
| `widget_pendencias_pos` | JSON String (`{ x: number, y: number }`) | Remembers position coordinates on screen |
| `widget_pendencias_minimized` | String (`"true"` \| `"false"`) | Remembers whether widget is expanded or minimized |

### 1.2 Data Structure (`StickyNote` Interface)
Located in `src/App.tsx` (lines 138-143):

```typescript
interface StickyNote {
  id: string;         // Unique identifier (UUID or random string fallback)
  text: string;       // Content/description of the pending item
  completed: boolean; // True if marked done, false if active
  createdAt?: string; // ISO 8601 UTC timestamp string (e.g. "2026-07-31T14:48:29.123Z")
}
```

### 1.3 React State & Persistence Lifecycle
- **Initialization (lines 147-154):** Loads initial state from `localStorage.getItem('widget_pendencias_items')`.
- **Sync Effect (lines 175-177):**
  ```typescript
  useEffect(() => {
    localStorage.setItem('widget_pendencias_items', JSON.stringify(stickyNotes));
  }, [stickyNotes]);
  ```

---

## 2. Instantiation, Saving, and Rendering Architecture

### 2.1 Instantiation & Creation Flow
- **Function:** `handleAddStickyNote` (`src/App.tsx`, lines 224-235).
- **Trigger:** `<form onSubmit={handleAddStickyNote}>` rendered at the bottom of the floating widget (lines 2525-2566).
- **Instantiation Logic:**
  ```typescript
  const handleAddStickyNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStickyText.trim()) return;
    const newNote = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      text: newStickyText.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    setStickyNotes(prev => [...prev, newNote]);
    setNewStickyText('');
  };
  ```

### 2.2 Rendering Locations in UI
1. **Sidebar Navigation Button (`src/App.tsx`, lines 1210-1248):**
   - Displays a count badge showing uncompleted pending items (`stickyNotes.filter(n => !n.completed).length`).
2. **Floating Widget (Minimized State) (`src/App.tsx`, lines 2308-2354):**
   - Renders a floating circular button with a red badge showing uncompleted item count.
3. **Floating Widget (Expanded State) (`src/App.tsx`, lines 2355-2570):**
   - **Header Handle (lines 2358-2422):** Drag-and-drop handle, minimize button, and close button.
   - **Body (lines 2425-2522):** Scrollable list mapping over `stickyNotes`.
   - **Item Component (lines 2441-2519):**
     - Checkbox toggling `completed` state via `toggleStickyNote(id)`.
     - Text span with strikethrough styling when `completed === true`.
     - **SLA Badge (`src/App.tsx`, lines 2474-2494):** Static red badge rendered when `isStickySlaDelayed(note)` is true.
     - Delete button triggering `deleteStickyNote(id)`.

---

## 3. Timestamp Creation & Migration Strategy

### 3.1 New Items
New pending items are automatically assigned `createdAt: new Date().toISOString()` upon creation in `handleAddStickyNote`.

### 3.2 Backward Compatibility & Migration Strategy
For legacy items created before `createdAt` was added or items with invalid/missing timestamps:

1. **State Initialization Migration:**
   Enhance `useState` initialization of `stickyNotes` in `src/App.tsx` (lines 147-154) to audit parsed items. If any item lacks `createdAt`, assign `new Date().toISOString()` (or a fallback timestamp) and persist back to `localStorage`.

   ```typescript
   const [stickyNotes, setStickyNotes] = useState<StickyNote[]>(() => {
     try {
       const saved = localStorage.getItem('widget_pendencias_items');
       if (!saved) return [];
       const parsed: StickyNote[] = JSON.parse(saved);
       
       let needsMigration = false;
       const migrated = parsed.map(note => {
         if (!note.createdAt) {
           needsMigration = true;
           return { ...note, createdAt: new Date().toISOString() };
         }
         return note;
       });

       if (needsMigration) {
         localStorage.setItem('widget_pendencias_items', JSON.stringify(migrated));
       }

       return migrated;
     } catch {
       return [];
     }
   });
   ```

2. **Safe Helper Evaluation (Defensive Check):**
   Ensure `isStickySlaDelayed` gracefully returns `false` if `createdAt` is missing or invalid:
   ```typescript
   const isStickySlaDelayed = (note: { completed: boolean; createdAt?: string }): boolean => {
     if (note.completed) return false;
     if (!note.createdAt) return false;
     const createdTime = new Date(note.createdAt).getTime();
     if (isNaN(createdTime)) return false;
     const diffInMinutes = (Date.now() - createdTime) / (1000 * 60);
     return diffInMinutes >= 120;
   };
   ```

---

## 4. Implementation Recommendations for Requirement R2

### 4.1 Requirement R2 Summary
Display a static `"SLA Atrasada"` warning badge next to any pending item that remains **uncompleted** after 2 hours (120 minutes) from its creation.

### 4.2 Exact Code Locations & Recommended Modifications

#### 1. Data Model (`src/App.tsx`, lines 138-143)
```typescript
interface StickyNote {
  id: string;
  text: string;
  completed: boolean;
  createdAt?: string; // ISO timestamp
}
```

#### 2. Helper Logic (`src/App.tsx`, lines 408-415)
Ensure SLA calculation explicitly checks:
- Item must NOT be completed (`note.completed === false`).
- Time elapsed since `createdAt` is `>= 120` minutes (7,200,000 ms / 2 hours).

```typescript
const isStickySlaDelayed = (note: { completed: boolean; createdAt?: string }): boolean => {
  if (note.completed) return false;
  if (!note.createdAt) return false;
  const createdTime = new Date(note.createdAt).getTime();
  if (isNaN(createdTime)) return false;
  const diffInMinutes = (Date.now() - createdTime) / (1000 * 60);
  return diffInMinutes >= 120;
};
```

#### 3. Periodic UI Refresh (Optional Improvement)
To ensure the warning badge updates dynamically without requiring user interaction when the 120-minute mark is crossed:

```typescript
const [, setTick] = useState(0);
useEffect(() => {
  const interval = setInterval(() => setTick(t => t + 1), 60000); // refresh every minute
  return () => clearInterval(interval);
}, []);
```

#### 4. UI Badge Component (`src/App.tsx`, lines 2474-2494)
Verify and maintain the badge next to the note text:

```tsx
{isStickySlaDelayed(note) && (
  <span 
    style={{
      backgroundColor: '#ef4444',
      color: 'white',
      fontSize: '0.65rem',
      fontWeight: 700,
      borderRadius: '4px',
      padding: '1px 5px',
      textTransform: 'uppercase',
      marginLeft: '6px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      verticalAlign: 'middle'
    }}
    title="Criado há mais de 2 horas (120 minutos)"
  >
    <FiAlertCircle size={9} /> SLA Atrasada
  </span>
)}
```

---

## 5. Verification & Testing Plan
1. **New Item Creation:** Create a new pending note via the widget UI. Confirm in browser DevTools (`Application > Local Storage > widget_pendencias_items`) that the JSON object contains a valid ISO timestamp string in `createdAt`.
2. **Legacy Migration:** Manually edit `LocalStorage` key `widget_pendencias_items` to remove `createdAt` from a note. Refresh the application and verify that a default `createdAt` timestamp is automatically generated and persisted.
3. **SLA Warning Threshold (< 120 min):** Set `createdAt` of an uncompleted note to 119 minutes ago. Verify NO `"SLA Atrasada"` badge appears.
4. **SLA Warning Threshold (>= 120 min):** Set `createdAt` of an uncompleted note to 121 minutes ago (`new Date(Date.now() - 121 * 60 * 1000).toISOString()`). Verify that the red `"SLA Atrasada"` badge appears next to the pending note text.
5. **Completed Item Override:** Toggle the checkbox of an overdue note to completed (`completed: true`). Verify that the `"SLA Atrasada"` badge disappears.

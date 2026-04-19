# Strabismus Measurement App: Architectural Analysis

## Step 4: Architectural Approaches

### Approach A: Full React + Canvas (Recommended for MVP)
**Stack:** React 18 + react-konva + IndexedDB + React Context

**Strengths:**
- Native browser canvas rendering (60 FPS capable)
- Excellent for interactive geometry manipulation (drag/rotate)
- Direct pixel-to-mm scaling with PPMM calibration
- Lightweight deployment (no build server required for MVP)
- Cross-platform: desktop/laptop/tablet via browser

**Weaknesses:**
- Canvas pixel artifacts at certain zoom levels
- Color filtering requires careful SVG filter implementation
- Limited offline capabilities without Service Worker (added complexity)

**MVP Suitability:** ★★★★★ (Best fit)

---

### Approach B: Web-based + SVG (Alternative)
**Stack:** React + SVG + D3.js + LocalStorage

**Strengths:**
- SVG natively supports color transformation filters
- Easier anaglyph implementation via `<feColorMatrix>`
- Cleaner DOM for accessibility auditing
- Simpler pixel-to-measurement conversion

**Weaknesses:**
- SVG rendering slower for 100ms data capture intervals
- More complex interaction code for drag/rotate with SVG
- Difficulty with high-precision calibration overlays

**MVP Suitability:** ★★★☆☆ (Good but canvas better for measurements)

---

### Approach C: Electron Desktop App
**Stack:** Electron + React + Canvas + Local file system

**Strengths:**
- Native file I/O without Service Worker
- Offline-first by default
- Can access system hardware directly

**Weaknesses:**
- Overkill for MVP (adds build/packaging complexity)
- Larger distribution footprint
- Maintenance burden for cross-platform builds

**MVP Suitability:** ★★☆☆☆ (Defer to Phase 2+)

---

### Approach D: Hybrid (Canvas + SVG)
**Stack:** React + react-konva (canvas) + react + SVG filters

**Strengths:**
- Canvas for measurement interaction
- SVG filters applied over canvas elements
- Best of both worlds

**Weaknesses:**
- More complex codebase
- Harder to debug interactions across layers
- Potential performance overlap

**MVP Suitability:** ★★★☆☆ (Unnecessary complexity for MVP)

---

## Step 5: Recommended Solution Design

### 5.1 Architecture Decision: Approach A (React + Canvas)

**Rationale:**
1. **Measurement Precision:** Canvas provides pixel-level control critical for PPMM calibration
2. **Interactive Performance:** Drag/rotate operations at 60 FPS essential for real-time visual feedback
3. **Offline Support:** Service Worker + IndexedDB handles offline requirement without overkill
4. **MVP Timeline:** Minimal scaffolding; can be deployed as static SPA immediately
5. **Scale Simplicity:** PPMM calibration directly manages pixel-to-mm conversion

---

### 5.2 Component Structure

```
App (Root)
├── CalibrationScreen
│   ├── CardSizer (draggable rectangle)
│   ├── PPMMDisplay
│   └── ConfirmButton
├── MainWorkflow
│   ├── ExerciseSelector
│   ├── AssessmentCanvas
│   │   ├── StaticCross (red, fixed)
│   │   ├── UserCross (green, interactive)
│   │   ├── BackgroundGrid
│   │   └── CoordinateDisplay
│   ├── DataCaptureControl
│   │   ├── StartButton
│   │   ├── StopButton
│   │   └── ClearButton
│   └── SessionSummary
└── DataExplorer
    ├── SessionList
    ├── SessionDetails
    └── ExportCSV
```

---

### 5.3 Data Flow Architecture

```
User Input (Mouse/Keyboard)
    ↓
AssessmentCanvas (react-konva interaction handlers)
    ↓
State: { x_cm, y_cm, rotation_deg, ppmm }
    ↓
TimeSeries Logger (100ms interval snapshot if changed)
    ↓
SessionStore (React Context)
    ↓
IndexedDB (persisted)
    ↓
DataExplorer / ExportCSV
```

---

### 5.4 Canvas Architecture Details

**Static Layer (Red Cross):**
- Horizontal line: fixed at y=0, extends ±10cm
- Vertical line: fixed at x=0, extends ±10cm
- Centimeter grid ticks every 1cm
- Non-interactive; provides reference frame

**User Layer (Green Cross):**
- Identical structure to static layer
- Draggable via mouse; center point is drag handle
- Right-mouse-button drag rotates around center
- Arrow keys: 1mm translation (fine-tuning)
- Real-time position display in status bar

**Rendering Strategy:**
- `react-konva` Stage with two Layers
- Static layer uses `Group` with `Line` and `Text` elements
- User layer uses draggable `Group` with rotation transformation
- Refresh on mouse move and arrow key events

---

### 5.5 Calibration Strategy

**Input:** User aligns rectangle to ISO credit card (85.60mm × 53.98mm)

**Process:**
1. Display resizable rectangle on screen
2. User drags edges to match physical card
3. Capture rectangle width in pixels: `rect_width_px`
4. Calculate: `PPMM = rect_width_px / 85.60`
5. Store in Context + IndexedDB

**Validation:**
- Display measured card dimensions in both pixels and millimeters
- Allow user to re-calibrate if unsatisfied
- Show warning if PPMM seems unrealistic (e.g., <0.5 or >20 PPMM)

---

### 5.6 Color Filtering for Anaglyph Mode

**Implementation:**
- SVG `<filter>` applied to Stage using Konva's `filters` property
- Pure Red Matrix: only R channel; zero G, B
- Pure Green Matrix: only G channel; zero R, B
- Toggle via UI checkbox; live preview with glasses

**Potential Issues:**
- React re-renders may flicker filter transitions; use `useRef` to skip unnecessary re-renders
- Color calibration may require per-monitor tweaking; document as user setting

---

### 5.7 Data Storage Schema

**IndexedDB Structure:**
```javascript
{
  sessionId: "uuid-1234",
  timestamp: "2026-03-25T14:30:00Z",
  exerciseTag: "Left-Tendon-Stretch",
  ppmm: 3.847,
  timeSeries: [
    { t: 0,   x: 0.0,  y: 0.0,  r: 0.0 },    // baseline
    { t: 100, x: 0.3,  y: 0.1,  r: 0.0 },
    { t: 200, x: 0.5,  y: 0.2,  r: 2.1 },
    // ... captured every 100ms or on change
  ]
}
```

**Export Strategy:**
- CSV: One row per time sample; columns: sessionId, timestamp, exerciseTag, x_cm, y_cm, rotation_deg
- CSV download triggered from DataExplorer UI

---

## Step 6: Concise Technical Specification

### 6.1 MVP Scope (Phase 1)

**In Scope:**
1. **Calibration Module:** Credit card PPMM calibration
2. **Assessment Canvas:** Static + user-controlled crosses, drag/rotate/arrow-key controls
3. **Time-Series Capture:** Record position & rotation at 100ms intervals (or on change)
4. **Session Storage:** IndexedDB persistence
5. **Exercise Selection:** Predefined exercise dropdown
6. **CSV Export:** Download captured sessions

**Out of Scope:**
- Anaglyph color filtering (Phase 2)
- Progress analytics / trendlines (Phase 2)
- Multi-user accounts (Phase 2+)
- Server backend (Phase 2+)
- PDF reporting (Phase 2+)

### 6.2 Functional Requirements

| Requirement | Type | Priority | Details |
|-------------|------|----------|---------|
| Calibration | Feature | P0 | Align rectangle to credit card; calculate PPMM |
| Static Cross | Feature | P0 | Red cross on canvas; fixed position; 20cm total span |
| User Cross | Feature | P0 | Green cross; draggable; rotatable (RMB); arrow keys for fine-tune |
| Session Start/Stop | Feature | P0 | Begin/end time-series capture |
| Time-Series Log | Feature | P0 | Capture x, y, rotation every 100ms or on change |
| Exercise Selection | Feature | P1 | Dropdown to choose predefined exercise |
| CSV Export | Feature | P1 | Download session data as CSV |
| Offline Storage | Feature | P0 | All data persists in IndexedDB; no network required |
| High Contrast UI | Feature | P1 | Pure #FF0000 (red) and #00FF00 (green) on dark background |

### 6.3 Non-Functional Requirements

| Requirement | Target | Details |
|-------------|--------|---------|
| Response Time | <50ms | User interaction (drag/rotate) to canvas update |
| Rendering FPS | 60 FPS | Smooth animation during interaction |
| Calibration Accuracy | ±1mm | PPMM calculation within hardware tolerance |
| Offline Capability | 100% | No network dependency for MVP |
| Session Capacity | 1000+ sessions | IndexedDB can hold months of data |
| Accessibility | WCAG AA | High contrast; keyboard navigation for canvas |

### 6.4 Tech Stack Finalized

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React 18 | Established, modular, large ecosystem |
| Canvas | react-konva | High-performance 2D; simplifies Konva API wrapper |
| State | React Context | MVP-scale simplicity; no Redux boilerplate |
| Storage | IndexedDB | Offline-first; larger capacity than localStorage |
| Styling | CSS-in-JS (emotion) | Component-scoped styles; theme support |
| Build | Vite | Fast dev reload; minimal config for SPA |
| Deployment | Static hosting (Vercel/GitHub Pages) | No backend required for MVP |

---

## Step 7: Review Checklist

### Questions for User:

1. **Canvas Rendering:** Are you comfortable with react-konva for the interactive measurement interface, or would you prefer a SVG-based approach?

2. **Offline Storage:** IndexedDB can hold 50-100MB per browser profile. Is this sufficient for months of local-only data, or do you anticipate larger datasets requiring server-side storage sooner?

3. **Anaglyph in MVP?** This spec defers anaglyph color filtering to Phase 2. Should it be included in MVP, or is the standard red-green mode sufficient for initial validation?

4. **Exercise Library:** Should the MVP include a hardcoded list of 5-10 common exercises, or do you want the ability for users to add custom exercises from day 1?

5. **Progress Tracking:** For MVP, should we defer analytics/trendlines, or include a simple "average deviation per session" dashboard?

6. **Deployment:** Are you planning to host this on a static server (Vercel, GitHub Pages) or a private server? This affects offline capability requirements.

---

## Step 8: User Approval Checklist

- [ ] Architectural approach (React + Canvas) is acceptable
- [ ] Component structure is clear and logical
- [ ] Data flow makes sense for offline-first workflow
- [ ] Tech stack is appropriate for MVP
- [ ] Scope (what's in vs. out) aligns with expectations
- [ ] I'm ready to proceed to implementation planning

---

## Next Steps After Approval

Once you confirm the above, I will:

1. **Write `artifacts/investigation_summary.md`** with:
   - Executive summary of approach
   - Design doc reference
   - Key constraints for write-plan
   - File reference index

2. **Return to Orchestrator** for next phase (write-plan / implementation)

---

**Document Version:** 1.0
**Last Updated:** 2026-03-25
**Status:** Ready for User Review

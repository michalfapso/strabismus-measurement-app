# Strabismus Measurement App: Investigation Summary

## Summary

The investigation confirms that a **Canvas/react-konva MVP** is the optimal approach for this clinical oculomotor assessment tool. This architecture prioritizes precision measurement via PPMM calibration, offline-first local storage with IndexedDB, and rapid iteration on a static-hosted SPA (GitHub Pages). The design defers complex features (anaglyph color filtering, server backend, PDF reporting) to Phase 2+, allowing fast MVP validation with clinicians.

---

## Design Documentation

**Primary Design Document:** `docs/DESIGN.md`
- Full architectural specification (component structure, data flow, canvas details, calibration strategy)
- Functional requirements matrix (P0 vs P1 features)
- Non-functional targets (60 FPS rendering, <50ms interaction response, ±1mm calibration accuracy)
- Tech stack rationale and dependency list
- Phase roadmap (MVP → Phase 2+ scope breakdown)

---

## Brainstorm Conclusions

### Strategy: Canvas/react-konva MVP

**Core Approach:**
- **React 18** for component composition and state management
- **react-konva** for high-performance 2D canvas with drag/rotate interaction
- **React Context** for session/calibration state (no Redux complexity at MVP stage)
- **IndexedDB** for offline-first local persistence (1000+ sessions capacity)
- **GitHub Pages** for static deployment (zero backend maintenance)

**Key Design Decisions:**

1. **Custom Exercises from Day 1:**
   - Hardcoded predefined list (5–10 common exercises: "Pencil Push-ups," "Brock String," "Extreme Rotation," etc.)
   - "No Exercise/Control" option for baseline sessions
   - Path to user-defined exercises deferred to Phase 2

2. **Offline-First Architecture:**
   - All measurement data captured and stored locally in IndexedDB
   - No network dependency for MVP operation
   - Service Worker integration optional (future enhancement)

3. **PPMM Calibration as MVP Priority:**
   - Credit card (85.60mm × 53.98mm) resizable-rectangle calibration screen (Phase 1, P0)
   - User aligns physical card to on-screen rectangle; app calculates PPMM
   - All canvas objects scale by this PPMM factor
   - Stored in Context + IndexedDB; user can re-calibrate at any session

4. **100ms Update Intervals:**
   - Time-series logger captures `{ t, x_cm, y_cm, r_deg }` snapshots
   - Records every 100ms OR on significant change (sub-millimeter precision)
   - Efficient for longitudinal trend analysis without excessive data bloat

5. **Tablet Support:**
   - Touch events handled by react-konva (drag for position, two-finger rotation)
   - Responsive canvas scales to device viewport
   - High-contrast UI (#FF0000 red / #00FF00 green) optimized for tablets

6. **Skip Anaglyph in MVP:**
   - Deferred to Phase 2
   - MVP focuses on standard red-green mode (no SVG `<feColorMatrix>` filtering)
   - Anaglyph color dissociation can be added once core measurement flow is validated with clinicians

---

## File Reference Index

### Core Specification & Architecture

**`spec1.md`**
- Technical requirements for Lancaster red-green test implementation
- Clinical principles of color dissociation and oculomotor assessment
- Detailed math for PPMM calibration and anaglyph filtering

**`ARCHITECTURE.md`**
- Step 4: Architectural approaches (A: React+Canvas, B: SVG, C: Electron, D: Hybrid)
- Step 5: Recommended solution (Approach A rationale, component structure, data flow, canvas details)
- Step 6: Concise technical specification (MVP scope, requirements matrix, tech stack finalization)
- Step 7–8: Review & approval checklist

---

### Core Modules (MVP)

**Calibration Module** (Phase 1, P0)
- Input: Credit card dimensions (85.60mm × 53.98mm)
- Process: Resizable rectangle UI; user aligns to physical card
- Output: PPMM (pixels per millimeter)
- Storage: React Context + IndexedDB
- Allows re-calibration at start of each session

**Assessment Canvas** (Phase 1, P0)
- Static layer: Red cross (fixed position, ±10cm span, centimeter ticks)
- User layer: Green cross (draggable, rotatable via RMB, arrow-key fine-tuning)
- Real-time coordinate display
- 100ms sampling interval for position/rotation capture
- Canvas rendered via react-konva Stage with two Layers

**Data Capture & Time-Series Logger** (Phase 1, P0)
- Records `{ t: ms, x: cm, y: cm, r: deg }` per snapshot
- Triggered every 100ms or on significant change
- Linked to session start/stop UI controls

**Exercise Tracking** (Phase 1, P1)
- Dropdown selector with predefined exercises
- "No Exercise/Control" option for baseline
- Stored as `exerciseTag` in session metadata
- Path to custom exercises (Phase 2)

**Session Management & Export** (Phase 1, P1)
- Session metadata: `sessionId` (UUID), `timestamp` (ISO8601), `exerciseTag`, `ppmm`, `timeSeries`
- IndexedDB persistence
- CSV export (download button in DataExplorer)
- CSV format: sessionId, timestamp, exerciseTag, x_cm, y_cm, rotation_deg

---

### MVP Scope (In Phase 1)

**In Scope:**
- ✅ Calibration module (credit card PPMM)
- ✅ Static + user-controlled crosses (red/green)
- ✅ Drag/rotate/arrow-key interaction
- ✅ Time-series capture (100ms intervals)
- ✅ Session persistence (IndexedDB)
- ✅ Exercise selection dropdown
- ✅ CSV export
- ✅ Offline-first operation
- ✅ Responsive tablet UI

**Out of Scope (Phase 2+):**
- ❌ Anaglyph color filtering / eye dissociation calibration
- ❌ Longitudinal analytics / trendline dashboards
- ❌ Multi-user accounts / authentication
- ❌ Server backend / cloud sync
- ❌ PDF reporting
- ❌ Advanced statistics (efficacy comparison by exercise, torsional stability metrics)

---

### Future Phases

**Phase 2: Color & Analytics**
- Implement anaglyph filters (SVG `<feColorMatrix>`)
- Per-monitor color calibration (R/G channel tuning)
- Longitudinal trendline charts (recharts integration)
- Exercise efficacy comparison dashboard

**Phase 3: Backup & Reporting**
- Server-side data sync (optional)
- Multi-device sync via auth
- PDF session reports with charts
- Statistical summaries (mean deviation, rotation variance)

**Phase 4: Advanced Measurement**
- Torsional stability tracking (cyclodeviation trend analysis)
- Refined anaglyph color matrices per monitor
- Fatigue warnings (2-minute rest prompts)
- Advanced exercise library management

---

### Tech Stack (Confirmed)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **UI Framework** | React 18 | Established, modular, large ecosystem |
| **Canvas Rendering** | react-konva | High-perf 2D; simplifies Konva API; 60 FPS capable |
| **State Management** | React Context | MVP simplicity; no Redux boilerplate |
| **Data Storage** | IndexedDB | Offline-first; 50–100MB capacity per profile |
| **Styling** | CSS-in-JS (emotion/styled-components) | Component-scoped; theme support |
| **Build Tool** | Vite | Fast HMR; minimal SPA config |
| **Charting (Phase 2)** | recharts | React integration; longitudinal trendlines |
| **Deployment** | GitHub Pages / Vercel | Static SPA; zero backend; instant CDN |

---

### Key Constraints for Write-Plan

1. **Offline-First:**
   - All user data captured and persisted locally
   - No network calls required for core measurement workflow
   - Service Worker optional (Phase 2+ optimization)

2. **PPMM Calibration Priority:**
   - Calibration screen is the first user-facing feature after app load
   - Must be fast, reliable, and re-runnable (users may change devices/monitors)
   - Stored value used to scale all canvas coordinates

3. **100ms Update Intervals:**
   - Time-series logger fires every 100ms during active measurement
   - Efficient for clinical longitudinal analysis (granular enough for trend detection, not excessive)
   - Can optimize with "change detection" (only log if position/rotation delta exceeds threshold)

4. **Tablet Support:**
   - Touch event handling for canvas (drag via single-finger, rotation via two-finger pinch)
   - Responsive layout (full-screen canvas with minimal chrome)
   - High-contrast colors (#FF0000, #00FF00) for visibility under various lighting

5. **Skip Anaglyph in MVP:**
   - Reduces Phase 1 complexity significantly
   - Standard red-green mode sufficient for initial clinician feedback
   - Color filtering (SVG filters + monitor calibration) deferred to Phase 2 with full feedback loop

---

## Document Control

- **Version:** 1.0
- **Date:** 2026-03-25
- **Status:** Ready for Implementation (Write-Plan Phase)
- **Approval:** Canvas/react-konva approach confirmed; custom exercises from day 1; offline-first; PPMM calibration priority; 100ms intervals; tablet support; skip anaglyph MVP

---

## Transition to Write-Plan

The Orchestrator will now spawn the write-plan phase, which will:

1. Decompose the MVP scope into atomic, implementable user stories
2. Define file structure (component tree, module boundaries)
3. Generate detailed implementation checklists (calibration, canvas, data logger, export)
4. Establish testing strategy (unit, integration, e2e)
5. Create phased commit plan for iterative development

All decisions documented in this summary remain binding constraints for the write-plan.

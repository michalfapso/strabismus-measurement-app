# Segmentation Bug Analysis

## Bug Summary
The overlapping segments issue in real data is caused by **two critical flaws in the boundary refinement functions** (`refineEnter` and `refineExit`).

## Root Cause

### Bug 1: `refineEnter()` Missing Upper Bound Check
**Location:** `src/utils/sessionMetrics.ts`, lines 129-148

```typescript
function refineEnter(T_detected: number, ...) {
  const searchStart = T_detected - halfLongWindowS;  // Lower bound
  // NO UPPER BOUND!

  for (let i = 0; i < timeSeries.length; i++) {
    const time = (timeSeries[i].t - t0) / 1000;
    if (time >= searchStart && Math.abs(shortSlopes[i]) > LONG_SLOPE_THRESHOLD) {
      return time;  // Could be T_detected + 100s!
    }
  }
}
```

**Problem:** The search bracket should be `[T_detected - 2.5s, T_detected]`, but the code only checks the lower bound. It can return times arbitrarily far past `T_detected`, extending the segment far beyond its intended boundary.

### Bug 2: `refineExit()` Scans from Wrong Direction
**Location:** `src/utils/sessionMetrics.ts`, lines 150-172

```typescript
function refineExit(T_detected: number, ...) {
  const searchStart = T_detected - halfLongWindowS;  // Lower bound only

  let lastAbove = T_detected;
  for (let i = timeSeries.length - 1; i >= 0; i--) {  // ← Starts from END!
    const time = (timeSeries[i].t - t0) / 1000;
    if (time < searchStart) break;  // Only stops at lower bound
    if (Math.abs(shortSlopes[i]) > LONG_SLOPE_THRESHOLD) {
      lastAbove = time;
      break;
    }
  }
  return lastAbove;
}
```

**Problem:**
1. Scans from the END of the entire dataset backward (i = timeSeries.length - 1)
2. Only stops when time < searchStart (lower bound)
3. Never checks upper bound, so it searches through the entire session instead of just the ±2.5s bracket
4. Returns the FIRST crossing found when scanning backward = the LAST crossing before T_detected (could be hours before!)

**Example failure:** For T_detected = 1.1s, searchStart = -1.4s
- Scans from index 331 down
- Never finds time < -1.4 until it reaches the beginning
- Might return time = 0.5s (where a slope crossing exists)
- Extends segment to end at 0.5s, which is BEFORE the segment start!

### Bug 3: Stretching Creates Overlapping Segments
After filtering short segments and stretching to fill gaps, adjacent kept segments can overlap.

**Example:**
- Segment 4: FUSION, indices 64-87 (3.2-4.35s)
  - Stretches forward to cover filtered segment 5 (4.4-4.55s)
  - Ends at 4.55s
- Segment 6: DRIFTING, indices 92-295 (4.6-14.75s)
  - Stretches backward to cover same filtered segment 5
  - Starts at 4.4s

**Result:** Overlapping segments (3.2-4.55) and (4.4-14.75s)

When refinement then extends boundaries further, overlaps become massive.

## Impact

- Segments overlap by >100% (coverage 225%+)
- Session statistics become meaningless
- Impossible to interpret results

## Solution

1. **Fix refineEnter:** Add upper bound check
2. **Fix refineExit:** Scan from the correct direction within bracket
3. **Post-stretch validation:** Ensure segments are non-overlapping

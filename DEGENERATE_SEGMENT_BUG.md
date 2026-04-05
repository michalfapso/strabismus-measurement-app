# Degenerate Segment Bug in Overlap Validation

## Problem Observed in Webapp

```
Segment 3: NEAR_FUSION from 9.61s to 8.87s, pixels 187-172
                           ^^^^^ > ^^^^^  BACKWARDS!
```

A segment with startTime > endTime is degenerate and invalid.

## Root Cause

The overlap validation when adjusting segment boundaries can create degenerate segments:

```typescript
// When segments overlap:
if (stretchedSegments[i].endTime > stretchedSegments[i + 1].startTime) {
  const midpoint = (stretchedSegments[i].endTime + stretchedSegments[i + 1].startTime) / 2;
  stretchedSegments[i].endTime = midpoint;           // Safe
  stretchedSegments[i + 1].startTime = midpoint;    // ⚠️ DANGER!
}
```

**Example scenario:**
- Segment i: 2.79s to 10.00s (FUSION) — after stretching
- Segment i+1: 9.61s to 8.87s (NEAR_FUSION) — tiny segment, somehow backward?

If i+1 was originally small (say 9.61-9.80s = 0.19s) and something already made it backward, the midpoint adjustment makes it worse.

**Or alternatively:**
- Segment i: 2.79s to 10.50s (FUSION)
- Segment i+1: 10.00s to 10.10s (NEAR_FUSION) — tiny 0.1s segment

Midpoint = (10.50 + 10.00) / 2 = 10.25

Result:
- Segment i: 2.79s to 10.25s ✓
- Segment i+1: 10.25s to 10.10s ✗ DEGENERATE

## Coverage Issue

Coverage < 100% happens when:
1. First segment doesn't start at session start (timeSeries[0].t / 1000)
2. Last segment doesn't end at session end
3. Gaps exist between segments

**The stretching logic SHOULD ensure full coverage** by:
- Extending first kept segment backward to session start
- Extending last kept segment forward to session end
- All filtered segments covered by neighbors

But something is breaking this, possibly the degenerate segment bug or improper segment creation.

## Solution Required

1. **Detect and fix degenerate segments** (startTime > endTime)
   - Swap if backwards
   - OR delete if they're noise
   - OR extend to valid range

2. **Ensure full coverage**
   - Force first segment to start at timeSeries[0].t / 1000
   - Force last segment to end at timeSeries[last].t / 1000
   - Validate no time gaps

3. **Better overlap handling**
   - Don't create degenerate segments
   - Clip segments to valid ranges
   - Ensure start <= end after any adjustment

4. **Need real data to debug**
   - The webapp is using different/longer data (35.3s vs our 16.55s test)
   - Current test files don't trigger this bug
   - Need to see the actual timeSeries causing the issue

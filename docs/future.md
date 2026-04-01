# Future Features & Enhancements

Living document collecting ideas and deferred work. Items here are out of scope for the current
implementation phase but worth preserving for future consideration.

---

## Clinical Analysis — Phase 2+

### FSM Tuning Exposure
`slopeThreshold` (0.1 cm/s for deviation, 0.1°/s for rotation) and minimum segment duration (0.5s)
are hardcoded constants in Phase 1. Expose these as user-adjustable settings in the analysis
config panel in Phase 2 so the FSM can be tuned to individual patient signal characteristics.

### Savitzky-Golay Auto-Tuning
Currently the SG window size is user-adjustable (5–21 points) with a quality warning based on
`smoothedVariance / rawVariance`. A more principled alternative:

- Use `ml-savitzky-golay-generalized` (already in the mljs ecosystem) which auto-selects window
  size based on signal SNR and entropy.
- Or compute the analysis at multiple window sizes and select the one minimising a smoothness
  quality criterion (e.g. minimising residual noise while preserving fusion-event peaks).

Evaluate after Phase 1 on real patient data.

### HMM State Classifier
Replace the rule-based FSM with a 5-state Gaussian Hidden Markov Model (DRIFTING, APPROACHING,
NEAR_FUSION, FUSION — or revised state set). Benefits: probabilistic transitions, natural handling
of noisy signals, learns session-specific transition dynamics.

Implementation notes from R2 in `docs/stats_ideas.md`:
- 5-state Gaussian HMM with Viterbi decoding; Baum-Welch EM training
- Custom TypeScript implementation (~300 lines) to avoid `@tensorflow/tfjs` bundle overhead
- Requires labelled or self-supervised training data to initialise correctly

Defer to Phase 2 if rule-based FSM proves too fragile on real-world noisy data.

### Cross-Metric Correlation Analysis
When both deviation and rotation metrics are selected in multi-session analysis, show a
cross-metric note analysing whether deviation and rotation performance are correlated across
sessions (e.g. "Sessions with high deviation fusion rate also tend to show high rotation
fusion rate — consistent binocular control pattern").

Removed from Phase 1 `CombinedQualityInsight` because with only 2 metrics the note is too
thin to be clinically useful without more sessions. Revisit in Phase 2.

### Changepoint Detection
Identify structural breakpoints within a session (e.g. "patient stabilised at t=45s",
"fatigue onset at t=120s"). Candidate algorithms from `docs/stats_ideas.md` R3:

- **CUSUM** (~20 lines): single mean-shift detector; good for "time-to-stable"
- **BinSeg** (~100 lines): O(N log N); adequate for 3–10 breakpoints
- **PELT / ED-PELT** (~200 lines, port from C#/Go): globally optimal; best for offline analysis

---

## Session Quality Scoring

### Composite Score
A weighted composite session quality score was considered but deferred because clinically
validated weights do not exist in the published literature. Sub-scores (fusion events, best
streak, time-to-first-fusion, trajectory) are displayed individually instead.

If clinical validation data becomes available, the candidate formula (from `docs/stats_ideas.md`):
```
score = w1 * log(1 + bestFusionStreak) + w2 * fusionEventCount - w3 * largeDeviationTime
```
Log-scaling dampens the effect of one very long streak (clinically more intuitive than a linear ratio).

### Distribution Shape Metrics
Histogram shape analysis using `simple-statistics` (all implementable with no additional library):

- **Bimodality coefficient (Sarle's BC)**: `(skewness² + 1) / (kurtosis + correction)`. BC > 0.555
  indicates bimodality — clinically meaningful when a patient oscillates between two stable states.
- **Shannon entropy**: `H = -Σ pᵢ log₂(pᵢ)`. High entropy = chaotic deviation; low = consistent.
- **Hartigan's Dip Test**: gold-standard bimodality test; requires O(N²) lookup table; defer to Phase 3.

---

## Report & History Features

### Report Caching
If multi-session insight recalculation exceeds 1s (large session count or complex baseline),
cache computed insights inside `ReportSnapshot` in IndexedDB. Add a `computedAt` timestamp
and invalidate cache if underlying sessions change.

### Comparison Mode
Overlay two saved `ReportSnapshot` configs side-by-side in the multi-session analysis view.
Useful for comparing a baseline period against a treatment period.

### Export
Export a report as PDF or structured clinical note format. Include: patient identifier (manual
input), date range, selected metrics, all insight sections, and key charts as images.

---

## Patient & Scheduling Features

### Patient-Facing Simplified View
Plain-language interpretation mode showing only: today's streak, whether fusion was achieved,
and a simple progress indicator. Aimed at home use without clinician present.

### Measurement Page Scheduling
Daily exercise schedule recommendations driven by `RecommendationInsight` data. Show which
exercise to do today and estimated session duration based on recent trends.

---

## Cross-Session Analysis

### Time-of-Day Effects
Analyse whether session performance varies systematically by time of day (morning vs evening).
Requires storing session start time (currently stored as a date, check if time is preserved).

### Session Sequence Effects
Does performing Brock String before Pencil Push-ups improve results? Requires tracking exercise
order within a day. Not in current data model.

### DTW Session Similarity
Use `dynamic-time-warping-ts` to compute similarity between sessions. Could identify "template
sessions" (a patient's best-ever performance pattern) and measure how close recent sessions are.
O(N*M) per pair; manageable for N=M≤200 resampled points.

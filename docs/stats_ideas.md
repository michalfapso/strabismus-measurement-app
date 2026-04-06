# Statistical Analysis Ideas for Measurement Time Series

This document collects ideas for extracting meaningful insights from strabismus measurement sessions,
and documents the design decisions, bugs, and lessons learned in the segmentation algorithm.
It is a living research document — add ideas freely, mark promising ones, note dead ends.

---

## The Core Problem

A single session produces a time series of `(t, x, y, rotation)` measurements.
Naive summary statistics (mean deviation, median) are clinically misleading because:

- A session with 3s of fusion followed by 60s of large deviation has the same *mean* as a session
  with consistently moderate deviation — but these are very different clinical outcomes.
- Percentage of session spent in fusion is distorted by session length: a user who achieves fusion,
  then spends a long time trying to re-achieve it, gets penalised by a low fusion time %.
- A session with no fusion but consistently low-moderate deviation may be more clinically
  meaningful than one with one brief fusion spike followed by chaotic deviation.
- **A user who never achieves fusion will produce only STABLE_DEVIATION segments, but sessions
  with lower mean deviation or less drift are still meaningfully better.** The algorithm needs
  to distinguish between them.

---

## Segmentation Algorithm: Design Notes & Lessons Learned

This section documents the implementation of the rule-based state machine classifier, the bugs
encountered in real clinical data, and the open design problems that remain.

### Overview: Dual-Timescale Slope Detection

The classifier works by computing slopes at two timescales on the smoothed deviation series:

| Window | Size | Threshold (enter) | Purpose |
|--------|------|-------------------|---------|
| Short  | 0.5s | 1.0 cm/s          | Detects rapid changes (fast convergence/divergence) |
| Long   | 2.5s | 0.15 cm/s (enter), 0.08 cm/s (stay) | Detects slow, sustained drift |

Classification at each point uses OR logic:
- `APPROACHING` if shortSlope < -1.0 **or** longSlope < -0.15 (or -0.08 while already APPROACHING)
- `DRIFTING` if shortSlope > 1.0 **or** longSlope > 0.15 (or 0.08 while already DRIFTING)
- `STABLE_DEVIATION` otherwise (and deviation above fusion threshold)

A **local flatness check** runs before slope logic: if stddev of raw values in a ±0.25s window
is < 0.05 cm, the point is classified as STABLE_DEVIATION regardless of slopes. This handles
step changes between flat quantization levels that slope windows cannot detect.

After initial classification, boundaries of DRIFTING/APPROACHING segments are **refined** by scanning
within a ±2.5s bracket using short-window slopes to find more precise entry/exit points.

Short STABLE_DEVIATION segments are filtered by context:
- Surrounded by same-direction segments (DRIFTING+DRIFTING or APPROACHING+APPROACHING): kept only if ≥ 3s
- Turning point (DRIFTING+APPROACHING or vice versa): kept if ≥ 1.5s

### Bug History

#### Bug 1: Wrong Threshold in Refinement Functions (Critical — Fixed)

`refineEnter()` and `refineExit()` were comparing short-window slopes against
`LONG_SLOPE_THRESHOLD` (0.02 cm/s, later 0.1 cm/s) instead of `SHORT_SLOPE_THRESHOLD` (1.0 cm/s).
Almost any short-window slope exceeds 0.02, so the refinement would find crossings everywhere
and produce boundary times outside the intended bracket.

**Symptom:** Backward segments (`startTime > endTime`), overlapping segments (coverage > 100%).

**Fix:** Use `SHORT_SLOPE_THRESHOLD` (1.0 cm/s) in both refinement functions.

#### Bug 2: Unbounded Refinement Bracket (Critical — Fixed)

`refineEnter()` had no upper bound check; `refineExit()` scanned from the end of the entire
dataset rather than within the bracket. Both could return times far outside the intended
`[T_detected - bracket, T_detected]` range.

**Symptom:** Segment boundaries extending to arbitrary positions across the session.

**Fix:** Both functions now constrain their search to `[T_detected - REFINEMENT_BRACKET_S, T_detected]`.

#### Bug 3: Stretching Creating Overlapping Segments (Critical — Fixed)

After filtering short segments by MIN_SEGMENT_DURATION and stretching neighbors to cover gaps,
two adjacent kept segments could both stretch into the same gap, creating overlaps.

**Fix:** Five-step validation pipeline after stretching: detect/swap degenerate segments,
remove zero-duration segments, smarter overlap resolution, force first segment to session start,
force last segment to session end, fill remaining gaps.

### Key Design Decision: Decouple Refinement Bracket from Slope Window

The refinement bracket (`REFINEMENT_BRACKET_S = 2.5s`) is now independent of the long slope
window (`LONG_SLOPE_WINDOW_S = 2.5s`). These serve different purposes:

- **Slope window**: Controls lag and responsiveness of classification. Smaller = faster response
  but more sensitive to noise.
- **Refinement bracket**: Controls the search range when looking for precise boundaries.
  Must be large enough to encompass the true boundary even when initial classification placed it
  up to half-a-window away from reality.

Coupling them (setting bracket = window/2) caused the bracket to shrink when we reduced the
window from 5.0s to 2.5s, making the refinement unable to find boundaries in flat sections
longer than 1.25s.

### Hysteresis on Long-Slope Threshold

Using a single threshold for both entering and staying in DRIFTING/APPROACHING caused rapid
state oscillation when the long slope was near the threshold. The 2.5s window slides across
transition boundaries, causing the slope to drift up and down through the threshold.

**Fix:** Separate enter/stay thresholds:
- `LONG_SLOPE_THRESHOLD_ENTER = 0.15 cm/s` — harder to trigger a state change
- `LONG_SLOPE_THRESHOLD_STAY  = 0.08 cm/s` — easier to remain in current state

This creates a dead band that prevents rapid flipping without requiring a significantly
larger window.

### Remaining Edge Cases

| Case | Severity | Status |
|------|----------|--------|
| Flat → flat step change misclassified as APPROACHING | Medium | Fixed by flatness check |
| Long window lag at transition boundaries | Medium | Partially mitigated by hysteresis + shorter window |
| Metrics on segments < 0.5s may be unreliable | Low | Documented, no fix planned |
| Short-slope never fires in gradual drift (slope < 1.0 always) | Low | Long-slope handles this case |

---

## Promising Directions for Session Analytics

### 1. Absolute Event-Based Metrics (no length normalisation)

Instead of percentages, focus on *what the user achieved* regardless of session length:

- **Fusion events**: count of distinct episodes where deviation dropped below threshold
- **Best fusion streak** (seconds): longest single continuous period below threshold
- **Time to first fusion** (seconds): latency from session start to first sub-threshold point
- **Total fusion time** (seconds, not %): raw accumulated time below threshold
- **Fusion onset rate**: how quickly deviation drops toward threshold (slope of descent)

These are comparable across sessions of different lengths when used in combination.

### 2. Metrics for Non-Fusion Users

For users who never achieve fusion, all segments are STABLE_DEVIATION or DRIFTING. Meaningful
comparisons across their sessions still exist:

- **Mean deviation** per STABLE_DEVIATION segment — lower is better
- **Intra-segment slope** — negative slope means the patient is still improving within the stable period
- **Duration of STABLE_DEVIATION vs DRIFTING** — more stable time, less drift is better
- **Maximum deviation reached** — a proxy for how far the patient is from fusion threshold
- **Recovery speed after drift** — how quickly deviation drops after DRIFTING ends

These allow a STABLE_DEVIATION-only session at 3 cm to be correctly ranked better than one at 7 cm,
even though both have the same state profile.

### 3. Session State Classification (Current Implementation)

Model the time series as transitions between clinical states:

```
DRIFTING → APPROACHING → NEAR_FUSION → FUSION → DRIFTING
      ↑                                              ↓
      └──────────── STABLE_DEVIATION ────────────────┘
```

States:
- **DRIFTING**: deviation high, moving further from threshold
- **APPROACHING**: deviation decreasing toward threshold
- **NEAR_FUSION**: deviation within near-fusion band (threshold to threshold + 1 cm)
- **FUSION**: deviation below threshold
- **STABLE_DEVIATION**: deviation above threshold but not changing significantly

Per-session insight from classification:
- Duration and count of each state
- Number of fusion cycles (attempt count)
- Time spent approaching vs drifting (effort quality)
- Segment quality metrics: median, min, max, variance, intra-segment slope

### 4. Session Quality Score: Alternatives to Fusion Time %

#### Why Fusion Time % Fails

Fusion-time-% combines two independent things: how often the user achieves fusion, and how long
they spend attempting after achieving it. A patient who achieves fusion at 10 seconds and then
continues for 4 more minutes gets penalised relative to one who achieves fusion at 10 seconds
and stops immediately.

#### Achievement-Based Component Scores

Break the composite score into independent sub-scores that clinicians can interpret separately:

| Sub-score | Formula | Clinical meaning |
|-----------|---------|-----------------|
| Responsiveness | `max(0, 1 - T_first / sessionDuration)` | How quickly did fusion first appear? |
| Repeatability | `min(fusionEvents / 5, 1.0)` (cap at 5) | Can the patient regain fusion repeatedly? |
| Peak capability | `log(1 + bestStreak_s) / log(1 + 60)` | Best sustained fusion, normalised to 60s |
| Stability penalty | `largeDeviationTime_s / sessionDuration` | Fraction of session with high deviation |

**Recommendation: Display individual sub-scores rather than a single composite score** until
clinical evidence for weighting is available.

#### Log-Scaled Metrics

Applying `log(1 + x)` to duration-based metrics dampens the effect of extremely long streaks:
- A 120s streak scores `log(121) ≈ 4.8`; a 60s streak scores `log(61) ≈ 4.1` — a 2× streak
  yields only 17% more score, which is more clinically intuitive than a 2× ratio.
- **Recommendation: USE** log scaling for any duration that can vary by orders of magnitude.

#### Half-Session Comparison

Compare mean deviation in the first half vs second half of a session:
- `secondHalfMean < firstHalfMean` → patient improved during session
- `secondHalfMean > firstHalfMean` → possible fatigue or loss of technique
- The ratio `firstHalfMean / secondHalfMean` is dimensionless and comparable across sessions.

**Recommendation: IMPLEMENT.** No new library needed.

#### Trajectory Score (Intra-Session Improvement)

A linear regression slope of deviation over time (in cm/minute):
- Negative slope = patient is converging toward fusion during the session (good)
- Positive slope = patient is diverging (fatiguing or deteriorating)
- Near-zero slope = stable (good if at low deviation, concerning if at high deviation)

`simple-statistics.linearRegression()` provides this directly.

### 5. Changepoint Detection

Identify structural breakpoints where behaviour changes significantly — when the user first
"got it", when fatigue set in, regime changes mid-session.

#### PELT (Pruned Exact Linear Time)

- Finds the exact globally optimal set of changepoints under a penalised cost function.
- Time complexity: O(N) average, O(N²) worst case. For N=6000, still fast in-browser.
- Penalty parameter λ controls the number of breakpoints. BIC penalty (λ = log(N)) is a reasonable default.
- No JS implementation found; port from C# or Go ED-PELT reference takes ~1–2 days (~200 lines).
- **Recommendation: IMPLEMENT (Phase 2).** Best algorithm for offline analysis of completed sessions.

#### BOCPD (Bayesian Online Changepoint Detection)

- Probabilistic; produces a posterior over change-point locations.
- Suited to streaming/online use; can also run offline.
- Dormant JS/TS implementation: `BayesianChangePointJS` (GitHub only, `mathew-kurian/BayesianChangePointJS`).
  Code is readable, ~9 commits, no releases, created 2020. Review before use.
- **Recommendation: CONSIDER** if real-time session feedback is ever needed.

#### CUSUM

- Detects a single mean shift at a time. O(N), ~20 lines of TypeScript.
- **Recommendation: IMPLEMENT FROM SCRATCH** for "time-to-stable" (first point where running
  mean deviation crossed near-fusion threshold and stayed there).

#### Binary Segmentation (BinSeg)

- Recursively applies a single-changepoint test. O(N log N). Simpler than PELT, less accurate.
- **Recommendation: CONSIDER** as an easier alternative to PELT if effort is a constraint.

#### Computational Cost Summary

| Algorithm | Complexity | N=200 | N=6000 | Implementation |
|-----------|-----------|-------|--------|----------------|
| CUSUM     | O(N)      | trivial | trivial | ~20 lines custom |
| BinSeg    | O(N log N)| trivial | fast | ~100 lines custom |
| PELT      | O(N) avg  | fast | fast | ~200 lines port from C#/Go |
| BOCPD     | O(N)      | fast | fast | dormant JS library |

### 6. Within-Session Trajectory Analysis

- Is the patient improving *during* the session (negative slope of deviation over time)?
- Do they maintain improvements or regress?
- Is the first half better or worse than the second half? (fatigue indicator)
- `simple-statistics.linearRegression()` provides this directly.

### 7. Cross-Session Patterns

- Time-of-day effects, day-after effects
- Exercise sequence effects (does Brock String prime Pencil Push-up performance?)
- Learning curves per exercise type

### 8. Distribution Shape Analysis

#### Bimodality Detection

The deviation histogram may show bimodality when a patient oscillates between two states
(e.g. fused at ~0 cm and drifting at 3–5 cm). Clinically meaningful: suggests a learnable
fusion response even if unstable.

**Bimodality Coefficient (Sarle's BC)**

```
BC = (skewness² + 1) / (kurtosis + correction)
correction = 3(n-1)² / ((n-2)(n-3))
```

- BC > 5/9 ≈ 0.555 indicates bimodality.
- Both `skewness` and `kurtosis` available from `simple-statistics`.
- Trivial to implement (~10 lines). **Recommendation: IMPLEMENT.**
- **Limitation:** Can misclassify some unimodal distributions when skewness is high. Use as
  a screening heuristic, not a definitive test.

**Hartigan's Dip Test** — the gold-standard formal test for bimodality. No JS npm package
found. R (`diptest`) and Python implementations exist. Requires O(N²) table lookups for p-values.
**Recommendation: DEFER to Phase 3.** Use BC as first approximation.

**Silverman's Bandwidth Test** — more powerful than BC but requires KDE and bootstrap for
p-values. No JS implementation found. **Recommendation: AVOID** for now. BC + visual inspection
of the histogram is sufficient.

#### Distribution Entropy

Shannon entropy of the histogram bin probabilities:
```
H = -Σ p_i * log2(p_i)   (where p_i = bin_count_i / total_count)
```
- Low entropy = concentrated (patient consistently at one deviation level).
- High entropy = spread (patient's deviation is variable/chaotic).
- ~8 lines of code. **Recommendation: IMPLEMENT.**

#### Skewness Interpretation

- **Right-skewed** (positive): mostly large deviation with occasional fusion. Early-stage therapy.
- **Left-skewed** (negative): mostly near-fusion with occasional deviations. Advanced performance.
- **Near-zero with high kurtosis**: consistent moderate deviation.
- `simple-statistics.sampleSkewness()` and `sampleKurtosis()` available directly.

#### Sample Size Considerations

Skewness and kurtosis are unreliable for < ~50 observations. The bimodality coefficient is
computed over raw data points (not bins), so sample size for BC should be evaluated on the
point count (200–6000 points in typical sessions — sufficient).

---

## Open Questions

- ~~What is the minimum session length to produce meaningful stats?~~ **→ 10 seconds minimum**
- ~~Should near-fusion time contribute positively to the session score?~~ **→ Yes, near-fusion time counts**
- ~~How to handle sessions where fusion is never achieved?~~ **→ Track per-segment metrics; mean deviation, intra-segment slope, and STABLE vs DRIFTING ratio remain meaningful**
- Is there a clinically established scoring system for orthoptic exercise sessions to reference? *(R3: no per-session score exists; `minValue` trend maps loosely to vergence amplitude)*
- Are there published HMM or changepoint approaches for oculomotor assessment data? *(Larsson et al. 2019 — see R5)*
- Should the flatness check threshold (0.05 cm) vary with the fusion threshold, or be fixed?
- Can we detect "stuck at plateau" (patient at stable deviation, not improving) vs "recovering" (stable but trending down)?

---

## Research Findings

### R1. JS/TS Library Survey

#### Recommended Libraries

**`simple-statistics`** — USE
- Features: mean, median, std dev, variance, IQR, skewness, kurtosis, linear regression,
  correlation, t-tests, chi-squared, Mann-Whitney U, Pearson r, KDE.
- ~35 KB minified, ~10 KB gzipped, no dependencies, ships `.d.ts`.
- First-choice library for all basic stats needs in this project.

**`ml-savitzky-golay`** — USE for pre-processing
- Savitzky-Golay smoothing: polynomial least-squares over a sliding window.
- Preserves peaks and local features (important for detecting fusion events in noisy signal).
- Maintained by mljs org (actively developed). TypeScript, small (<5 KB).
- *Note:* Simple moving average is currently used instead — Savitzky-Golay was producing
  negative values from positive data in early tests. Worth re-evaluating.

**`dynamic-time-warping-ts`** — USE if session similarity is needed
- TypeScript-native fork of `GordonLesti/dynamic-time-warping`. No dependencies, small.
- For cross-session comparison at N=M=200 resampled points: ~40,000 operations — fast in-browser.
- For full pairwise comparison of 50 sessions: O(S² × N²) — consider limiting to comparing
  against a representative template or previous session only.

**`jstat-esm`** — CONSIDER
- Statistical distributions (beta, gamma, Weibull, Poisson, etc.), pdf, cdf, inverse CDF.
- ~50 KB minified, tree-shakeable. More distributions than `simple-statistics`.
- Only needed if distribution-based hypothesis tests are required in Phase 2+.

**`kalmanjs`** — CONSIDER for real-time use only
- 1D Kalman filter. Causal (past data only), introduces lag. Last published ~7 years ago, stable.
- Less suitable than Savitzky-Golay for post-hoc analysis. Good for live session smoothing.

#### Libraries Evaluated and Rejected

**`moving-averages` (EMA/SMA)** — AVOID
- EMA is ~5 lines to implement inline. Adding a package dependency is not justified.

**`dsp-collection`** — CONSIDER only for Phase 3
- IIR/FIR filters, FFT, window functions. TypeScript, recently active.
- Only if frequency-domain analysis (detecting oscillatory deviation patterns) is needed.
  Overkill for current use cases.

**`hidden-markov-model-tf`** — AVOID
- TensorFlow.js dependency (~300–500 KB gzipped). Prohibitive for an offline SPA.
- A custom Baum-Welch + Viterbi implementation is ~300–400 lines TypeScript and avoids
  the dependency entirely.

**`hmm`, `nodehmm`, `hidden-markov-model`** — AVOID
- All last published 7–10 years ago. No TypeScript support. Abandoned.

**`BayesianChangePointJS`** — CONSIDER WITH CAUTION (Phase 2)
- GitHub only (`mathew-kurian/BayesianChangePointJS`). Pure TypeScript BOCPD implementation.
- 9 commits, no releases, no recent activity. Dormant but readable and small enough to fork.
- Review code quality before committing to it.

**`dynamic-time-warping` (GordonLesti)** — AVOID
- Last published 9 years ago, no TypeScript. Use the TypeScript fork above instead.

**`dtw` (npm)** — AVOID
- Minimal, ~8 years old, no TypeScript.

**`ruptures` (Python)** — REFERENCE ONLY
- Gold-standard Python library for offline changepoint detection (PELT, BOCPD, BinSeg, Window).
- No JS port exists. Use as algorithm reference when implementing in TypeScript.

**`@tensorflow/tfjs`** — AVOID
- 300–500 KB gzipped. Not justified for a 5-state HMM on 200–6000 points.

---

### R2. Session State Classification Approaches

#### Option A: Rule-Based FSM (Current Approach) — Recommended for Phase 1

Deterministic, inspectable, ~50–200 lines TypeScript, no training data required.
Handles variable session lengths naturally. Output is directly interpretable clinically.

**Weaknesses:** Sensitive to threshold and window parameters. Rapid state flickering near
thresholds → requires hysteresis. Cannot model uncertainty (a point is always in exactly one state).

#### Option B: Hidden Markov Model — Recommended for Phase 2

5-state Gaussian HMM trained on deviation + slope features via Baum-Welch EM, decoded with Viterbi.
Probabilistic, captures temporal structure, handles noise naturally. Used in oculomotor research
(Larsson et al. 2019, Behavior Research Methods).

**Weaknesses:** Requires labelled or carefully initialised data. Baum-Welch can converge to
local optima. Harder to explain to clinicians. No ready JS library without TensorFlow.js.
Custom implementation: ~300–400 lines TypeScript.

#### Option C: Sliding Window Classifier — Good complement to FSM

For each time point, classify a sliding window by mean deviation, slope, and variance.
Can assign continuous "state scores" rather than hard labels. Easy to tune.

**Weaknesses:** Does not model state continuity — cannot count distinct fusion episodes.
Edge effects at session start/end.

---

### R3. Clinical Scoring Systems

Published research does not define a per-session performance score. The field uses:
- **NPC** (Near Point of Convergence): normal ≤ 6 cm.
- **PFV** (Positive Fusional Vergence): normal ≥ 15 prism dioptres. Sheard's criterion: PFV ≥ 2 × heterophoria.
- **CISS** (Convergence Insufficiency Symptom Survey): 15-item, 0–60. Symptomatic: ≥ 21 (adults), ≥ 16 (children).

These are measured pre/post multi-week therapy programmes, not per-session.

**Closest published analogues to this app's metrics:**
- Best fusion streak ↔ Fusional vergence amplitude (both measure peak capability)
- Fusion events ↔ NPC recovery (both measure repeatability of achieving fusion)
- Time-to-first-fusion ↔ Vergence latency (both measure response speed)

The app's per-session metrics are novel contributions — exploratory biomarkers, not validated
clinical outcome measures. This mapping can be used to motivate them clinically.

---

### R4. Implementation Priority

| Feature | Effort | Phase |
|---------|--------|-------|
| Per-segment quality metrics (median, slope) | Done | 1 ✓ |
| Flatness check in classification | Done | 1 ✓ |
| Context-aware STABLE_DEVIATION duration filter | Done | 1 ✓ |
| Skewness, kurtosis, entropy | Low | 1 |
| Bimodality coefficient (Sarle's BC) | Low | 1 |
| Half-session deviation ratio | Low | 1 |
| Session slope (trajectory) | Low | 1 |
| CUSUM single-changepoint ("time-to-stable") | Low | 2 |
| PELT multi-changepoint | Medium | 2–3 |
| DTW session similarity | Low | 2–3 |
| Gaussian HMM state classifier | High | 3 |
| Hartigan's Dip Test | High | 3 |

---

### R5. Key Literature References

- **Tyrrell et al. (2019).** "Objective Evaluation of Visual Fatigue Using Binocular Fusion
  Maintenance." *Translational Vision Science & Technology*, 8(6). DOI: 10.1167/tvst.8.6.4.
  — BFM as fusion-maintenance duration metric; closest published analogue to per-session
  fusion-streak scoring.

- **Convergence Insufficiency Treatment Trial (CITT) studies (2008–2021).** Published in
  *Archives of Ophthalmology* and *JAAPOS*. Define standard clinical thresholds:
  NPC ≤ 6 cm, PFV ≥ 15 pd, CISS < 16 (children) / < 21 (adults).

- **Larsson et al. (2019).** "A hidden Markov model for analyzing eye-tracking of moving
  objects." *Behavior Research Methods*, 52, 2132–2145. DOI: 10.3758/s13428-019-01313-2.
  — HMM for eye-tracking state classification; supports feasibility of HMM for Phase 2.

- **Nyström & Holmqvist (2010).** "An adaptive algorithm for fixation, saccade, and glissade
  detection in eyetracking data." *Behavior Research Methods*. — Segmented linear regression
  for classifying eye movement states; applicable to deviation classification.

- **Adams et al. (2007).** "Bayesian Online Changepoint Detection." *arXiv:0710.3742*.
  — Reference paper for BOCPD algorithm.

- **Akinshin, A. (2022).** "ED-PELT: Implementation of an efficient algorithm for changepoint
  detection." https://aakinshin.net/posts/edpelt/ — Source for porting ED-PELT to TypeScript.

- **Horwood et al. (2014).** "Clinical test responses to different orthoptic exercise regimes
  in typical young adults." *Ophthalmic and Physiological Optics*, 34(2). DOI: 10.1111/opo.12109.
  — No per-session scoring; uses NPC, PFV, CISS as pre/post outcome measures.

---

## Research Tasks

- [x] Survey existing clinical scoring systems for orthoptic exercise outcomes
- [x] Evaluate JS/TS libraries for HMM, changepoint, DTW, signal processing
- [x] Find published approaches to oculomotor time series classification
- [x] Implement rule-based state machine classifier
- [x] Fix critical boundary refinement bugs (backward segments, overlaps)
- [x] Add hysteresis to prevent threshold oscillation
- [x] Reduce long slope window for faster response (5.0s → 2.5s)
- [x] Decouple refinement bracket from slope window
- [x] Implement flatness check to correctly classify flat regions
- [x] Implement context-aware STABLE_DEVIATION duration filter
- [x] Evaluate whether `sessionScore` should be log-scaled → Yes, use `log(1 + x)`
- [x] Research bimodality detection feasibility → BC is sufficient for Phase 1; Hartigan's deferred
- [ ] Implement Phase 1 stats metrics using `simple-statistics` (skewness, entropy, BC, half-session ratio)
- [ ] Evaluate Savitzky-Golay vs current moving average (revisit negative-value issue)
- [ ] Prototype CUSUM single-changepoint detection for "time-to-stable" metric
- [ ] Evaluate `BayesianChangePointJS` code quality before committing to it
- [ ] Test segmentation with synthetic noisy patterns: tremor, noise-only, single-point jump

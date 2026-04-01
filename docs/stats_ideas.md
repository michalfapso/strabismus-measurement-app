# Statistical Analysis Ideas for Measurement Time Series

This document collects ideas for extracting meaningful insights from strabismus measurement sessions.
It is a living research document — add ideas freely, mark promising ones, note dead ends.

## The Core Problem

A single session produces a time series of `(t, x, y, rotation)` measurements.
Naive summary statistics (mean deviation, median) are clinically misleading because:

- A session with 3s of fusion followed by 60s of large deviation has the same *mean* as a session
  with consistently moderate deviation — but these are very different clinical outcomes.
- Percentage of session spent in fusion is distorted by session length: a user who achieves fusion,
  then spends a long time trying to re-achieve it, gets penalised by a low fusion time %.
- A session with no fusion but consistently low-moderate deviation may be more clinically
  meaningful than one with one brief fusion spike followed by chaotic deviation.

## Promising Directions

### 1. Absolute Event-Based Metrics (no length normalisation)

Instead of percentages, focus on *what the user achieved* regardless of session length:

- **Fusion events**: count of distinct episodes where deviation dropped below threshold
- **Best fusion streak** (seconds): longest single continuous period below threshold
- **Time to first fusion** (seconds): latency from session start to first sub-threshold point
- **Total fusion time** (seconds, not %): raw accumulated time below threshold
- **Fusion onset rate**: how quickly deviation drops toward threshold (slope of descent)

These are comparable across sessions of different lengths when used in combination.

### 2. Session State Classification

Model the time series as transitions between clinical states:

```
DRIFTING → APPROACHING → NEAR_FUSION → FUSION → LOSING_FUSION → DRIFTING
```

Possible states:
- **Drifting**: deviation high, no clear convergence trend
- **Approaching**: deviation decreasing steadily toward threshold
- **Near-fusion**: deviation within near-fusion band (threshold to threshold + 1 bin)
- **Fusion**: deviation below threshold
- **Losing fusion**: deviation increasing from below threshold
- **Recovered**: returned to near-fusion or fusion after losing it

Per-session insight from classification:
- Duration of each state
- Number of fusion + losing-fusion cycles (attempt count)
- Whether user recovered fusion after losing it (resilience indicator)
- Time spent approaching vs drifting (effort quality)

Possible classification approaches:
- **Rule-based state machine**: simple threshold + slope rules, deterministic
- **Hidden Markov Model (HMM)**: probabilistic, handles noise well, learns transition probabilities
- **Sliding window slope classifier**: classify each window by mean deviation + local trend

### 3. Changepoint Detection

Identify structural breakpoints in the time series where behaviour changes significantly.
Useful for finding:
- When the user first "got it" (fusion onset)
- When fatigue set in (sustained deviation increase)
- Regime changes mid-session

Libraries/algorithms to evaluate:
- PELT (Pruned Exact Linear Time) — efficient, good for offline analysis
- BOCPD (Bayesian Online Changepoint Detection) — probabilistic, handles uncertainty
- `ruptures` (Python) — reference implementation; evaluate if JS port exists

### 4. Within-Session Trajectory Analysis

Score a session by its *trajectory* not just its values:
- Is the patient improving *during* the session (negative slope of deviation over time)?
- Do they maintain improvements or regress?
- Is the first half better or worse than the second half? (fatigue indicator)

### 5. Cross-Session Patterns

Beyond single-session metrics, look for patterns across sessions:
- Time-of-day effects (morning vs evening sessions)
- Day-after effects (does performance dip after intense sessions?)
- Exercise sequence effects (does Brock String priming improve Pencil Push-up performance?)
- Learning curves per exercise type (how quickly does the patient improve at each exercise?)

### 6. Distribution Shape Analysis

Rather than collapsing the histogram to a single number, characterise its shape:
- **Skewness**: right-skewed = mostly large deviation with occasional fusion; left-skewed = mostly near-fusion
- **Bimodality**: two peaks may indicate the user oscillates between two stable states
- **Entropy**: high entropy = chaotic; low entropy = consistent behaviour (good or bad)

### 7. Composite Session Quality Score (revised)

Instead of fusion time %, a score based on clinical achievement:
- Weight: **best fusion streak** (captures peak capability)
- Weight: **number of fusion events** (captures repeatability)
- Weight: **time-to-first-fusion** (captures responsiveness — lower is better)
- Weight: **large deviation time** (penalty for extended poor performance)
- Possible formula: `score = w1 * log(1 + bestFusionStreak) + w2 * fusionEventCount - w3 * largeDeviationTime`
  (log dampens the effect of one very long streak; weights to be determined clinically)

## Open Questions

- ~~What is the minimum session length to produce meaningful stats?~~ **→ 10 seconds minimum**
- ~~Should near-fusion time contribute positively to the session score?~~ **→ Yes, near-fusion time counts**
- ~~How to handle sessions where fusion is never achieved?~~ **→ Track `minValue` (minimum deviation reached); its trend across sessions shows progress even without fusion**
- Is there a clinically established scoring system for orthoptic exercise sessions to reference? *(Research R4: no per-session score exists; `minValue` trend maps loosely to vergence amplitude)*
- Are there published HMM or changepoint approaches for oculomotor assessment data? *(Research R2: Larsson et al. 2019 used HMM for eye-tracking state classification — see R2 findings)*

---

## Research Findings (March 2026)

The following sections document research conducted across six areas. Each subsection notes
libraries, approaches, clinical references, and implementation recommendations.

---

### R1. JS/TS Library Survey

#### General Statistics

**`simple-statistics`**
- npm: `simple-statistics`
- Features: descriptive stats (mean, median, std dev, variance, IQR, skewness, kurtosis),
  linear regression, correlation, t-tests, chi-squared, Mann-Whitney U, Pearson r,
  kernel density estimation.
- Bundle size: ~35 KB minified, ~10 KB gzipped (no dependencies).
- TypeScript: ships its own `.d.ts` declarations.
- Maintenance: actively maintained, high weekly downloads (millions), well-documented.
- **Recommendation: USE.** This should be the first-choice library for all basic stats needs
  in this project. Covers skewness, kurtosis, regression, and hypothesis tests with zero
  dependencies and a small footprint. Sufficient for Phase 1 analytics.

**`jStat` / `jstat-esm`**
- npm: `jstat` (legacy, CommonJS) or `jstat-esm` (ES module fork with tree-shaking)
- Features: statistical distributions (beta, gamma, Weibull, Poisson, hypergeometric, etc.),
  pdf, cdf, inverse CDF, sampling. Broader distribution coverage than `simple-statistics`.
- Bundle size: `jstat-esm` is ~50 KB minified, ~18 KB gzipped with full import; tree-shaking
  reduces this significantly if only a few functions are used.
- TypeScript: `jstat-esm` exports types; the original `jstat` requires `@types/jstat`.
- Maintenance: `jstat-esm` is more actively maintained than the original.
- **Recommendation: CONSIDER** if distribution-based hypothesis tests (e.g. t-distribution
  p-values, F-distribution) are needed beyond what `simple-statistics` provides. Not needed
  for Phase 1.

#### Signal Processing / Smoothing

**`ml-savitzky-golay`**
- npm: `ml-savitzky-golay`
- Purpose: Savitzky-Golay smoothing filter — polynomial least-squares fit over a sliding window.
  Preserves peaks and local features (important for detecting fusion events in a noisy signal).
- Maintained by the mljs organisation (actively developed; `ml-signal-processing` v2.1 published
  February 2026).
- TypeScript: full TypeScript support across the mljs ecosystem.
- Bundle size: small (single-purpose module, <5 KB).
- Also available: `ml-savitzky-golay-generalized` (auto-tunes parameters based on SNR/entropy).
- **Recommendation: USE** for pre-processing deviation time series before state classification
  or changepoint detection. Savitzky-Golay is preferred over simple EMA for this use case
  because it preserves fusion-event peaks rather than rounding them.

**`kalmanjs`**
- npm: `kalmanjs` (1D Kalman filter)
- Purpose: lightweight noise filter for 1D streams, no dependencies.
- TypeScript: via `@types/kalmanjs` (DefinitelyTyped).
- Maintenance: last published ~7 years ago; types updated more recently. Dormant but stable.
- Bundle size: negligible (<3 KB).
- Alternative: `kalman-filter` (npm) — more configurable multi-dimensional version, actively
  maintained, browser-compatible.
- **Recommendation: CONSIDER** as an alternative to Savitzky-Golay for real-time smoothing
  during live session recording. Less suitable than Savitzky-Golay for post-hoc analysis
  because it is causal (only uses past data) and lags the signal.

**EMA / Moving Average (`moving-averages`)**
- npm: `moving-averages`
- Features: SMA, EMA, DMA, WMA.
- TypeScript: limited (may need manual types).
- **Recommendation: CONSIDER** only if simplicity is paramount. EMA is trivial to implement
  from scratch (~5 lines) and should probably not require a dependency. Avoid adding a package
  for this.

**`dsp-collection`**
- npm: `dsp-collection`
- Written in TypeScript; last published early 2026 (recently active).
- Provides IIR/FIR filters, FFT, window functions.
- **Recommendation: CONSIDER** if frequency-domain analysis (e.g. detecting oscillatory
  patterns in deviation) is needed in a later phase. Overkill for current use cases.

#### Hidden Markov Models (HMM)

**`hidden-markov-model-tf`**
- npm: `hidden-markov-model-tf`
- Maintained by NearForm; uses TensorFlow.js as backend.
- Implements Baum-Welch (EM training) and Viterbi (state decoding) for Gaussian-emission HMMs.
- TypeScript: yes (TensorFlow.js is fully typed).
- Bundle size: **very large** — depends on `@tensorflow/tfjs`, which is ~300–500 KB gzipped
  depending on which backends are included.
- **Recommendation: AVOID** for production use in this app. The TensorFlow.js dependency is
  disproportionate for a 5-state HMM on 200–6000 points. The added weight would be felt in
  first load of an offline SPA. If HMM is needed, a custom Baum-Welch implementation for a
  discrete or Gaussian HMM over 5 states is tractable (~200 lines of TypeScript) and avoids
  the dependency entirely.

**Other HMM packages (`hmm`, `nodehmm`, `hidden-markov-model`)**
- All last published 7–10 years ago. No TypeScript support. Effectively abandoned.
- **Recommendation: AVOID.**

#### Changepoint Detection

**`BayesianChangePointJS`**
- npm: not published (GitHub only — `mathew-kurian/BayesianChangePointJS`)
- Pure TypeScript/JavaScript implementation of Bayesian Online Changepoint Detection (BOCPD).
- Browser and Node.js compatible. Generic TypeScript types.
- Maintenance: 9 commits, no releases published, created 2020, no recent activity. Dormant.
- **Recommendation: CONSIDER WITH CAUTION.** The code is readable and small enough to fork
  or inline. BOCPD is algorithmically sound for this use case (online, probabilistic). But the
  lack of releases or active maintenance means it should be reviewed and tested before use.

**ED-PELT (no JS package)**
- An efficient (O(N log N)) variant of PELT with nonparametric support, described in a 2016
  paper by Andrey Akinshin. Reference implementations exist in C# and Go.
- No npm package found. A GitHub Gist for PELT exists but is not packaged.
- **Recommendation: IMPLEMENT IF NEEDED.** ED-PELT is described as straightforward to port.
  For this application (200–6000 points, offline analysis), an in-house TypeScript port would
  be feasible (~150–300 lines). PELT's penalty-based formulation makes it well-suited to
  finding 3–10 regime changes in a session.

**CUSUM (no JS package)**
- Cumulative Sum algorithm for mean-shift detection. Simple and well understood.
- No dedicated npm package found for browsers.
- The sequential computation form is O(N) and trivial to implement from scratch (~20 lines).
- Limitation: only detects mean shifts; does not handle variance changes or non-stationarity.
- **Recommendation: IMPLEMENT FROM SCRATCH** for a simple single-changepoint detector
  (e.g. detecting "when did the patient first stabilise?"). Not suitable as the only
  changepoint method if multiple regime changes are expected.

**`ruptures` (Python)**
- The gold-standard Python library for offline changepoint detection (PELT, BOCPD, Binary
  Segmentation, Window-based). No JS port exists.
- **Recommendation: REFERENCE ONLY.** Use as algorithm reference when implementing in TS.
  Not suitable for in-browser use.

#### Dynamic Time Warping (DTW)

**`dynamic-time-warping-ts`**
- npm: `dynamic-time-warping-ts`
- TypeScript-native fork of `GordonLesti/dynamic-time-warping`. Provides `getDistance()` and
  `getPath()`.
- Bundle size: small (pure JS algorithm, no dependencies, estimated <5 KB).
- Maintenance: available since ~2021; limited commit history.
- **Recommendation: USE** if session-to-session similarity is needed. The algorithm for
  full-matrix DTW is O(N*M) and at N=M=200 (resampled sessions) is ~40,000 operations —
  very fast in-browser.

**`dynamic-time-warping` (GordonLesti)**
- npm: `dynamic-time-warping`
- Last published 9 years ago. No TypeScript.
- **Recommendation: AVOID** in favour of the TypeScript fork above.

**`dtw` (npm)**
- Minimal, last published ~8 years ago. No TypeScript.
- **Recommendation: AVOID.**

**DTW complexity note**: For cross-session comparison (e.g. comparing 50 sessions), the full
pairwise DTW matrix is O(S² * N²) which could be expensive. Consider limiting to comparing a
session against a "representative" template or the previous session only.

---

### R2. Session State Classification: Approaches Evaluated

#### Option A: Rule-Based State Machine

A deterministic finite state machine using threshold comparisons and local slope estimates.

**How it would work:**
1. Smooth the deviation series with Savitzky-Golay (window ~1–2 seconds).
2. Compute the local slope over a rolling window (e.g. 1 second = ~20 points at 50ms sampling).
3. Apply rules:
   - `deviation < threshold` → FUSION
   - `deviation < threshold + nearBand AND slope > 0` → LOSING_FUSION
   - `deviation < threshold + nearBand` → NEAR_FUSION
   - `slope < -slopeThreshold` → APPROACHING
   - otherwise → DRIFTING

**Strengths:**
- Fully deterministic and inspectable.
- No training data required.
- ~50 lines of TypeScript.
- Handles variable session lengths naturally.
- The output is directly interpretable in clinical terms.

**Weaknesses:**
- Sensitive to threshold and window-size parameters.
- Noise in the slope estimate can cause rapid state flickering (needs hysteresis or debounce).
- Cannot model uncertainty (a point is always in exactly one state).

**Feasibility for this app: Excellent.** This is the recommended starting point.

#### Option B: Hidden Markov Model

A 5-state Gaussian HMM trained on deviation + slope features via Baum-Welch EM.

**How it would work:**
1. Define 5 hidden states (DRIFTING, APPROACHING, NEAR_FUSION, FUSION, LOSING_FUSION).
2. Observations: [smoothed_deviation, slope_estimate] (2D Gaussian emissions).
3. Train transition matrix and emission parameters using Baum-Welch on labelled or
   self-supervised data.
4. Decode optimal state sequence using Viterbi.

**Strengths:**
- Probabilistic: naturally handles noisy transitions.
- Captures temporal structure (transition probabilities encode how long states persist).
- Well-studied in eye movement research (HMMs used for fixation/saccade classification since 2010s;
  a 2019 paper in Behavior Research Methods used HMM for eye-tracking of moving objects).

**Weaknesses:**
- Requires either labelled training data or carefully initialised parameters to converge correctly.
- Baum-Welch EM can converge to local optima — results depend on initialisation.
- Harder to debug and explain to clinicians than a rule-based system.
- No production-ready JS library available without TensorFlow.js overhead (see R1 above).
- A custom implementation is tractable but not trivial (~300–400 lines of TypeScript for
  a full Gaussian HMM with Viterbi).

**Feasibility for this app: Medium.** Appropriate as a Phase 2 enhancement if the rule-based
approach proves too fragile. The literature supports HMM use for oculomotor time series.

#### Option C: Sliding Window Classifier

For each time point, classify a sliding window (e.g. ±1 second) by:
- Mean deviation in window vs threshold bands
- Slope of linear regression within window
- Variance within window (high variance = unstable/drifting)

**Strengths:**
- Simpler than HMM. No training required.
- Can assign a continuous "state score" rather than a hard label.
- Easy to tune by adjusting window size.

**Weaknesses:**
- Edge effects at session start/end.
- Window size is a significant parameter: too short → noisy; too long → misses brief fusion events.
- Does not model state transitions (two adjacent windows may independently classify as FUSION
  even if they are not part of the same fusion episode).

**Feasibility for this app: Good** as a complement to or simplification of the rule-based FSM.
Less suited to counting fusion *events* (distinct episodes) because it doesn't explicitly model
state continuity.

#### Recommendation

Implement the **rule-based state machine (Option A)** first, with Savitzky-Golay pre-smoothing
and hysteresis on state transitions. This gives immediate clinical utility with minimal risk.
Reserve HMM for Phase 2 if rule-based classification proves too unreliable on noisy real-world data.

---

### R3. Changepoint Detection for Short Time Series

#### Context

Sessions of 200–6000 points at ~50ms sampling = 10s to 300s of data. We want to find 2–10
structural breakpoints (e.g. "user settled after 45 seconds", "fatigue onset at 120 seconds").

#### PELT (Pruned Exact Linear Time)

- Finds the exact globally optimal set of changepoints under a penalised cost function.
- Time complexity: O(N) average (amortised via pruning), O(N²) worst case.
- Space complexity: O(N).
- For N=6000 points, even worst-case is fast enough in-browser (milliseconds).
- Penalty parameter (λ) controls the number of breakpoints: too small → too many changepoints;
  too large → misses real ones. BIC/AIC penalty (λ = log(N)) is a reasonable default.
- No JS implementation found; porting from the C# or Go ED-PELT reference should take ~1–2 days.
- **Recommendation: IMPLEMENT (Phase 2).** Best algorithm for offline analysis of completed sessions.

#### BOCPD (Bayesian Online Changepoint Detection)

- Probabilistic; produces a posterior over change-point locations rather than point estimates.
- Suited to streaming/online use (processes points one at a time), though can also run offline.
- A dormant but functional JS/TS implementation exists (`BayesianChangePointJS` on GitHub).
- Requires specifying a hazard function (expected run length between changepoints) and a
  predictive model (conjugate prior, e.g. Gaussian with known variance).
- **Recommendation: CONSIDER.** Useful if the app ever moves toward real-time session feedback
  (BOCPD can run during a session). For offline analysis, PELT is preferable.

#### CUSUM

- Detects a single mean shift at a time.
- O(N), trivial to implement in ~20 lines.
- Not well-suited to multi-changepoint detection.
- **Recommendation: IMPLEMENT FROM SCRATCH** for the specific task of finding "time-to-stable"
  (first point at which the running mean deviation crossed the near-fusion threshold and stayed
  there). A CUSUM-style test is sufficient for this single-changepoint task.

#### Binary Segmentation (BinSeg)

- Recursively applies a single-changepoint test to sub-segments.
- O(N log N) time. Simpler to implement than PELT.
- Less accurate than PELT (greedy, not globally optimal) but often adequate for 3–10 breakpoints.
- **Recommendation: CONSIDER** as an easier alternative to PELT if implementation effort is
  a constraint.

#### Computational Cost Summary

| Algorithm | Complexity | N=200 | N=6000 | JS Implementation |
|-----------|-----------|-------|--------|-------------------|
| CUSUM     | O(N)      | trivial | trivial | ~20 lines |
| BinSeg    | O(N log N)| trivial | fast | ~100 lines |
| PELT      | O(N) avg  | fast | fast | ~200 lines (port from C#/Go) |
| BOCPD     | O(N)      | fast | fast | existing dormant JS library |
| BOCPD (full posterior) | O(N²) | fast | ~1s | not practical for N=6000 |

---

### R4. Clinical Scoring Systems Research

#### Established Clinical Measures in Orthoptic Practice

Published research does not use a per-session "quality score". Instead, the field uses a
set of objective clinical measures assessed before and after multi-week therapy programmes:

- **Near Point of Convergence (NPC)**: closest point at which both eyes can maintain
  binocular fusion. Normal: ≤6 cm. Measured at each clinical visit.
- **Positive Fusional Vergence (PFV)**: maximum convergence disparity before fusion breaks.
  Normal: ≥15 prism dioptres. Sheard's criterion: PFV ≥ 2 × magnitude of heterophoria.
- **Convergence Insufficiency Symptom Survey (CISS)**: 15-item questionnaire, 0–60 scale.
  Symptomatic: ≥21 (adults), ≥16 (children). Most widely used patient-reported outcome.
- **Objective vergence response parameters** (research settings, not routine clinical use):
  latency, peak velocity, settling time, accuracy for step-disparity stimuli. These are measured
  with laboratory eye-tracking equipment and analysed with custom algorithms.

#### Key Research Finding: No Per-Session Score Exists

The literature does not define a per-session performance score for vision therapy exercises.
Existing studies aggregate outcomes over weeks (typically 4–16 weeks) and use clinical measures
rather than in-session metrics. The closest analogue in the literature is **Binocular Fusion
Maintenance (BFM)** — the ability to sustain fusion under binocular stress — which has been
validated as a correlate of visual fatigue (Tyrrell et al., TVST, 2019). BFM is measured as
duration of maintained fusion under increasing demand, not as a time-series quality score.

#### Implication for This App

The app's per-session metrics (fusion events, best streak, time-to-first-fusion) are novel
contributions with no direct published equivalent. They should be treated as exploratory
biomarkers, not as validated clinical outcome measures. The closest validated analogues are:
- Best fusion streak ↔ Fusional vergence amplitude (both measure peak capability)
- Fusion events ↔ NPC recovery (both measure repeatability of achieving fusion)
- Time-to-first-fusion ↔ Vergence latency (both measure response speed)

This mapping can be used to motivate the metrics clinically, even in the absence of
direct validation.

---

### R5. Session Quality Scoring: Alternatives to Fusion Time %

#### Why Fusion Time % Fails

The core issue is that fusion-time-% combines two independent things: how often the user
achieves fusion, and how long they spend attempting after achieving it. A patient who achieves
fusion at 10 seconds and then continues for 4 more minutes gets penalised relative to one who
achieves fusion at 10 seconds and stops immediately.

#### Log-Scaled Metrics

Applying `log(1 + x)` to duration-based metrics (fusion streak length, total fusion time)
dampens the effect of extremely long streaks:
- A 120s streak scores `log(121) ≈ 4.8`; a 60s streak scores `log(61) ≈ 4.1` — a 2× streak
  yields only 17% more score, which is more clinically intuitive than a 2× ratio.
- **Recommendation: USE** log scaling for any duration that can vary by orders of magnitude.
  The formula already proposed in Section 7 above uses this correctly.

#### Achievement-Based Component Scores

Break the composite score into independent sub-scores that clinicians can interpret separately:

| Sub-score | Formula | Clinical meaning |
|-----------|---------|-----------------|
| Responsiveness | `max(0, 1 - T_first / sessionDuration)` | How quickly did fusion first appear? |
| Repeatability | `min(fusionEvents / 5, 1.0)` (cap at 5) | Can the patient regain fusion repeatedly? |
| Peak capability | `log(1 + bestStreak_s) / log(1 + 60)` | Best sustained fusion, normalised to 60s |
| Stability penalty | `largeDeviationTime_s / sessionDuration` | Fraction of session with high deviation |

Combining these into one number requires weights that are clinically arbitrary without
validation data. **Recommendation: Display individual sub-scores rather than a single composite
score** until clinical evidence for weighting is available.

#### Trajectory Score (Intra-Session Improvement)

A linear regression slope of deviation over time (in cm/minute) is a direct measure of
within-session improvement:
- Negative slope = patient is converging toward fusion during the session (good)
- Positive slope = patient is diverging (fatiguing or deteriorating)
- Near-zero slope = stable (good if at low deviation, concerning if at high deviation)

This is already partially captured by the TrendChart component for cross-session trends. The
same approach applies within a single session. `simple-statistics` provides `linearRegression()`
and `linearRegressionLine()` directly.

#### Half-Session Comparison

Compare mean deviation in the first half vs second half of a session:
- `secondHalfMean < firstHalfMean` → patient improved during session
- `secondHalfMean > firstHalfMean` → possible fatigue or loss of technique
- The ratio `firstHalfMean / secondHalfMean` is dimensionless and comparable across sessions.

**Recommendation: IMPLEMENT** as a simple, interpretable metric. No new library needed.

#### Absolute vs Composite Score

**Recommendation: Prefer absolute metrics over composite scores for this stage of the project.**
A composite score requires clinically validated weights, which do not exist in the published
literature for this type of exercise. Displaying 4–5 interpretable absolute metrics (best streak,
fusion events, time-to-first-fusion, session slope, half-session ratio) gives clinicians
more actionable information than a single opaque score.

---

### R6. Histogram Shape Analysis

#### Bimodality Detection

The deviation histogram (1 cm bins, typically 0–10 cm) may show bimodality when a patient
oscillates between two states (e.g. a "fused" state near 0 cm and a "drifting" state at 3–5 cm).
Detecting this is clinically meaningful: bimodality suggests the patient has a learnable fusion
response, even if unstable.

**Bimodality Coefficient (Sarle's BC)**

The bimodality coefficient is defined as:
```
BC = (skewness² + 1) / (kurtosis + correction)
```
where `correction = 3(n-1)²/((n-2)(n-3))` accounts for sample-size bias.

- BC > 5/9 ≈ 0.555 is the threshold for bimodality (compared against the uniform distribution).
- Both `skewness` and `kurtosis` are available from `simple-statistics`.
- The formula is trivial to implement from scratch (~10 lines) using these outputs.
- **Limitation**: BC can misclassify some unimodal distributions as bimodal when skewness is high.
  It is better suited as a screening heuristic than a definitive test.
- **Recommendation: IMPLEMENT** from scratch using `simple-statistics` outputs. No additional
  library needed.

**Hartigan's Dip Test**

- Formally tests unimodality vs non-unimodality by measuring the maximum deviation between the
  ECDF and the nearest unimodal distribution.
- The gold-standard test for bimodality; well-known in statistics literature.
- **JS/npm implementation**: No dedicated npm package found. Implementations exist in R (`diptest`)
  and Python (`diptest` on PyPI). A JavaScript port was not found on npm. The algorithm can be
  ported (the FORTRAN reference code is public domain), but it requires O(N²) table lookups for
  p-values which adds complexity.
- **Recommendation: DEFER.** Use BC as a first approximation. Hartigan's dip is appropriate
  for a Phase 3 enhancement if bimodality analysis becomes a core feature.

**Silverman's Bandwidth Test**

- Uses kernel density estimation (KDE) with progressively narrower bandwidths; detects the minimum
  bandwidth at which the KDE has k modes.
- More powerful than BC but computationally heavier and requires bootstrap for p-values.
- No JS npm implementation found. D3.js provides KDE primitives (Gaussian kernel) which could
  be used to build this manually.
- **Recommendation: AVOID** for now. Computationally intensive and no ready JS implementation.
  BC + visual inspection of the histogram is sufficient for initial deployment.

#### Distribution Entropy

Shannon entropy of the histogram bin probabilities:
```
H = -Σ p_i * log2(p_i)   (where p_i = bin_count_i / total_count)
```
- Maximum entropy (uniform distribution) = log2(num_bins), e.g. log2(10) = 3.32 bits for a 10-bin histogram.
- Low entropy = concentrated distribution (patient consistently at one deviation level).
- High entropy = spread distribution (patient's deviation is variable/chaotic).
- A JavaScript implementation is trivial (~8 lines) using `simple-statistics`' histogram or
  directly from bin counts. A GitHub Gist demonstrates the pattern:
  `bins.reduce((H, p) => p > 0 ? H - p * Math.log2(p) : H, 0)`.
- **Recommendation: IMPLEMENT** from scratch. No library needed. This is one of the most
  informative and cheapest-to-compute histogram metrics.

#### Skewness Interpretation

- Right-skewed (positive skewness): patient spends most time at high deviation with occasional
  fusion events. Early-stage therapy or difficult exercise.
- Left-skewed (negative skewness): patient mostly near fusion with occasional deviations.
  Advanced / well-controlled performance.
- Near-zero skewness with high kurtosis: patient has a consistent moderate deviation.
- `simple-statistics.sampleSkewness()` and `sampleKurtosis()` implement the sample-corrected
  versions directly.
- **Recommendation: USE** as qualitative session descriptors alongside the histogram display.

#### Sample Size Considerations

With 10–50 histogram bins and typical session sizes (200–6000 data points), there should be
sufficient counts per bin for reliable bin-level statistics. However:
- Very short sessions (< 30 seconds / ~600 points) may have sparse bins at extreme deviations.
- Skewness and kurtosis are unreliable for < ~50 observations (excess kurtosis especially).
- The bimodality coefficient is computed over the raw data points (not the bins), so sample
  size for BC should be evaluated on the point count, not the bin count.

---

### R7. Implementation Priority Summary

| Feature | Approach | Effort | Phase |
|---------|----------|--------|-------|
| Skewness, kurtosis, entropy | `simple-statistics` + trivial formulas | Low | 1 |
| Bimodality coefficient | 10 lines from `simple-statistics` | Low | 1 |
| Half-session deviation ratio | Trivial split + mean | Low | 1 |
| Session slope (trajectory) | `simple-statistics.linearRegression` | Low | 1 |
| Fusion events, best streak, time-to-first | Already in ideas doc | Low | 1 |
| Savitzky-Golay smoothing pre-processing | `ml-savitzky-golay` | Low | 1–2 |
| Rule-based state machine | Custom TypeScript FSM | Medium | 2 |
| CUSUM single-changepoint | ~20-line custom implementation | Low | 2 |
| PELT multi-changepoint | Port from C#/Go ED-PELT | Medium-High | 2–3 |
| DTW session similarity | `dynamic-time-warping-ts` | Low | 2–3 |
| Gaussian HMM state classifier | Custom TypeScript (~300 lines) | High | 3 |
| Hartigan's dip test | Port from FORTRAN/R | High | 3 |

---

### R8. Libraries and Tools: Final Verdict

| Library / Package | Recommendation | Reason |
|-------------------|---------------|--------|
| `simple-statistics` | **USE** | Small, zero-dep, TypeScript, covers Phase 1 needs |
| `ml-savitzky-golay` | **USE** | Small, TypeScript, mljs ecosystem, actively maintained |
| `jstat-esm` | **CONSIDER** | If distribution tests beyond `simple-statistics` are needed |
| `dynamic-time-warping-ts` | **USE if DTW needed** | TypeScript, small, no deps |
| `kalmanjs` | **CONSIDER** | For real-time smoothing only; dormant but stable |
| `moving-averages` | **AVOID** | EMA is trivial to implement inline; no dep needed |
| `dsp-collection` | **CONSIDER (Phase 3)** | Only if FFT/frequency analysis is needed |
| `hidden-markov-model-tf` | **AVOID** | TensorFlow.js overhead is prohibitive for this use case |
| `hmm`, `nodehmm` | **AVOID** | Abandoned, no TypeScript |
| `BayesianChangePointJS` | **CONSIDER (Phase 2)** | Dormant; review code before use; BOCPD algorithm is sound |
| `dynamic-time-warping` (legacy) | **AVOID** | Use TypeScript fork instead |
| `ruptures` (Python) | **REFERENCE ONLY** | No browser port exists |
| `@tensorflow/tfjs` | **AVOID** | 300–500 KB gzipped; not justified for analytics |

---

### R9. Key Literature References

- Horwood et al. (2014). "Clinical test responses to different orthoptic exercise regimes in
  typical young adults." *Ophthalmic and Physiological Optics*, 34(2). DOI: 10.1111/opo.12109.
  — No per-session scoring; uses NPC, PFV, CISS as pre/post outcome measures.

- Convergence Insufficiency Treatment Trial (CITT) studies (2008–2021). Published in *Archives of
  Ophthalmology* and *JAAPOS*. Define standard clinical thresholds: NPC ≤6 cm, PFV ≥15 pd,
  CISS <16 (children) / <21 (adults).

- Tyrrell et al. (2019). "Objective Evaluation of Visual Fatigue Using Binocular Fusion
  Maintenance." *Translational Vision Science & Technology*, 8(6). — BFM as fusion-maintenance
  duration metric; closest published analogue to per-session fusion-streak scoring.

- Nyström & Holmqvist (2010). "An adaptive algorithm for fixation, saccade, and glissade
  detection in eyetracking data." *Behavior Research Methods*. — Segmented linear regression
  approach to classifying eye movement states; applicable to deviation classification.

- Larsson et al. (2019). "A hidden Markov model for analyzing eye-tracking of moving objects."
  *Behavior Research Methods*, 52, 2132–2145. DOI: 10.3758/s13428-019-01313-2. — HMM for
  eye-tracking state classification; supports feasibility of HMM for state machine in Phase 2.

- Adams et al. (2007). "Bayesian Online Changepoint Detection." *arXiv:0710.3742*. — Reference
  paper for BOCPD algorithm used by `BayesianChangePointJS`.

- Akinshin, A. (2022). "ED-PELT: Implementation of an efficient algorithm for changepoint
  detection." Blog post with C# reference implementation. —
  https://aakinshin.net/posts/edpelt/ — Source for porting ED-PELT to TypeScript.

---

## Research Tasks (Updated)

- [x] Survey existing clinical scoring systems for orthoptic exercise outcomes
- [x] Evaluate JS/TS-compatible libraries for: HMM, changepoint detection, DTW, signal processing
- [x] Find published approaches to oculomotor time series classification
- [ ] Prototype rule-based state machine classifier on sample data
- [x] Evaluate whether `sessionScore` should be log-scaled or use a different formula
- [x] Research whether bimodality detection is feasible with small bin counts
- [ ] Implement Phase 1 metrics using `simple-statistics`
- [ ] Implement Savitzky-Golay pre-smoothing for deviation series
- [ ] Prototype CUSUM single-changepoint detection for "time-to-stable" metric
- [ ] Evaluate `BayesianChangePointJS` code quality before committing to it

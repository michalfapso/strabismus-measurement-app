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

- What is the minimum session length to produce meaningful stats? (very short sessions may be noise)
- Should near-fusion time contribute positively to the session score, or only full fusion?
- How to handle sessions where the patient *never* achieves fusion? (common early in therapy)
- Is there a clinically established scoring system for orthoptic exercise sessions to reference?
- Are there published HMM or changepoint approaches for oculomotor assessment data?

## Libraries and Tools to Evaluate

*(Needs research — see sub-agent research task)*

- **simple-statistics** (JS) — descriptive stats, regression; likely already sufficient for Phase 1 basics
- **ml-matrix** / **ml5.js** / **brain.js** — ML in browser
- **@tensorflow/tfjs** — if HMM or more complex classification is needed
- **changepoint** or **ruptures** — changepoint detection (Python-first; check for JS ports)
- **jStat** — statistical distributions and tests in JS
- DTW (Dynamic Time Warping) libraries for JS — session-to-session similarity
- HMM libraries for JS/TS — evaluate feasibility for state classification

## Research Tasks

- [ ] Survey existing clinical scoring systems for orthoptic exercise outcomes
- [ ] Evaluate JS/TS-compatible libraries for: HMM, changepoint detection, DTW, signal processing
- [ ] Find published approaches to oculomotor time series classification
- [ ] Prototype rule-based state machine classifier on sample data
- [ ] Evaluate whether `sessionScore` should be log-scaled or use a different formula
- [ ] Research whether bimodality detection is feasible with small bin counts

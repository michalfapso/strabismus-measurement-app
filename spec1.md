This specification document provides the technical requirements and architectural guidance for an AI agent to develop the React-based oculomotor assessment application. It synthesizes clinical principles of color dissociation with modern web engineering to ensure precise, longitudinal measurement of strabismus and ocular torsion.

### 1. Project Overview
The objective is to build a web application that enables users to quantify visual axes misalignment (diplopia) and rotation (cyclodeviation) using a digital implementation of the Lancaster red-green test. The app will support both standard viewing and anaglyph glasses modes, capture time-series measurement data, and correlate findings with specific oculomotor exercises .

### 2. Technical Stack
*   **Framework:** React 18+ (Next.js 14 optional).[1]
*   **Canvas Engine:** `react-konva` for high-performance coordinate manipulation and object dragging.[2]
*   **State Management:** React Context or a lightweight store (Zustand) for session and calibration data.[3]
*   **Storage:** `IndexedDB`.
*   **Visualization:** `recharts` for longitudinal trend analysis.[1]

### 3. Core Functional Modules

#### 3.1 Physical Unit Calibration (cm/mm)
Standard CSS units ($1\text{ cm} = 37.8\text{ px}$) are unreliable due to hardware DPI variations.[5, 6]
*   **Requirement:** Implement a "Credit Card Calibration" screen.[7]
*   **Logic:** Present a resizable rectangle. The user aligns it with a physical ISO/IEC 7810 card ($85.60\text{ mm} \times 53.98\text{ mm}$).[7]
*   **Formula:** Calculate Pixels Per Millimeter (PPMM) as:
$$PPMM = \frac{\text{Width}_{\text{pixels}}}{85.60}$$
*   **Scaling:** All canvas objects must scale their logical coordinates by this $PPMM$ factor to ensure $1\text{ cm}$ on screen matches $1\text{ cm}$ in reality.

#### 3.2 Fullscreen Assessment Canvas
*   **Static Layer:** A central horizontal and vertical axis cross with centimeter ticks at regular intervals.[8]
*   **User Layer:** A duplicate cross in a secondary color (e.g., Green if static is Red).[8]
*   **Interaction Logic:**
    *   **Translation:** Drag-and-drop the center of the duplicate cross using the mouse.[9]
    *   **Rotation:** While holding the **Right Mouse Button**, the user can rotate the duplicate cross around its center point.[10, 11]
    *   **Fine-tuning:** Support arrow keys for sub-millimeter position adjustments.[12]

#### 3.3 Anaglyph Eye Dissociation
To achieve clinical dissociation, the app must isolate color channels using SVG `<feColorMatrix>` filters to prevent "ghosting".[13, 14]
*   **Filters:**
    *   **Pure Red Matrix:**
$$\begin{bmatrix} R' \\ G' \\ B' \\ A' \\ 1 \end{bmatrix} = \begin{bmatrix} 1 & 0 & 0 & 0 & 0 \\ 0 & 0 & 0 & 0 & 0 \\ 0 & 0 & 0 & 0 & 0 \\ 0 & 0 & 0 & 1 & 0 \\ 0 & 0 & 0 & 0 & 1 \end{bmatrix} \begin{bmatrix} R \\ G \\ B \\ A \\ 1 \end{bmatrix}$$    *   **Pure Green Matrix:**$$\begin{bmatrix} R' \\ G' \\ B' \\ A' \\ 1 \end{bmatrix} = \begin{bmatrix} 0 & 0 & 0 & 0 & 0 \\ 0 & 1 & 0 & 0 & 0 \\ 0 & 0 & 0 & 0 & 0 \\ 0 & 0 & 0 & 1 & 0 \\ 0 & 0 & 0 & 0 & 1 \end{bmatrix} \begin{bmatrix} R \\ G \\ B \\ A \\ 1 \end{bmatrix}$$
*   **Settings:** User must be able to toggle "Anaglyph Mode" and swap colors between the left and right eye .
*   **Calibration:** User must be able to calibrate colors for left and right eye until he confirms for each color that he sees it only with one eye when using colored glasses.

#### 3.4 Exercise and Session Tracking
*   **Exercise Definitions:** Allow users to pre-define exercises (e.g., "Pencil Push-ups," "Brock String," "Extreme Rotation").[15, 16]
*   **Pre-Measurement Workflow:** Before each session, the user selects an exercise from their list or chooses "No Exercise/Control".
*   **Time-Series Recording:** During an active measurement session, the app should capture position and rotation data at $100\text{ ms}$ intervals if changes occur.[17, 18]

### 4. Data Architecture and Schema

#### 4.1 Storage Strategy
Session results are stored as JSON strings in `localStorage`.
*   **Metric Convention:** Store offsets in centimeters and rotation in degrees relative to the vertical axis.[19, 20]

#### 4.2 JSON Data Structure

| Key | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | UUID | Unique identifier for the measurement session. |
| `timestamp` | ISO8601 | Start time of the session.[21] |
| `exerciseTag` | String | The selected exercise (e.g., "Left-Tendon-Stretch").[10] |
| `ppmm` | Float | Calibrated pixels per millimeter. |
| `timeSeries` | Array | Array of objects: `{"t": offset_ms, "x": cm, "y": cm, "r": deg}`.[22] |

### 5. Statistical Analysis and UX Requirements

#### 5.1 Analytics
*   **Longitudinal Tracking:** Provide trendline bar charts showing the reduction (or change) in mean horizontal/vertical deviation over weeks/months.[23, 24]
*   **Efficacy Comparison:** Visualize deviations grouped by exercise type to identify which exercises result in the best alignment outcomes.
*   **Torsional Stability:** Plot rotation variance over time to measure the recovery of the superior oblique tendon.[20, 25]

#### 5.2 Accessibility for Diplopia
*   **High Contrast:** Use pure `#FF0000` (Red) and `#00FF00` (Green) on a high-contrast dark or white background to reduce visual confusion.[26, 27]
*   **Focus Management:** Ensure that interactive elements are clearly marked, as users with double vision may struggle with target acquisition.[28, 27]
*   **Safety:** Include a "Rest" prompt every 2 minutes to prevent ocular fatigue.[29, 30]

### 6. Development Roadmap for the AI Agent
1.  **Phase 1:** Build the calibration utility and establish the PPMM scaling constant.
2.  **Phase 2:** Implement the `react-konva` canvas with static and movable axes.
3.  **Phase 3:** Integrate SVG color filters for red-green glasses mode.
4.  **Phase 4:** Develop the time-series data logger and `localStorage` integration.
5.  **Phase 5:** Build the exercise selection and longitudinal data visualization dashboard.

I've outlined the technical architecture and data schema for your oculomotor assessment tool. Let me know if you would like me to expand on any specific section or provide the raw code templates for the AI agent.
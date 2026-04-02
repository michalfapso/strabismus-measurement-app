/**
 * Simple moving average smoothing.
 * More robust than Savitzky-Golay for this use case.
 * Preserves data range (no negative values from positive inputs).
 */
export function smoothSeries(data: number[], windowSize: number): number[] {
  if (windowSize % 2 === 0) {
    throw new Error(`Window size must be odd, got ${windowSize}`);
  }
  if (windowSize > data.length) {
    throw new Error(`Window size ${windowSize} exceeds data length ${data.length}`);
  }
  if (windowSize < 1) {
    throw new Error(`Window size must be at least 1, got ${windowSize}`);
  }

  const halfWindow = Math.floor(windowSize / 2);
  const result = new Array(data.length);

  for (let i = 0; i < data.length; i++) {
    // Calculate window boundaries
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length - 1, i + halfWindow);

    // Compute average of values in window
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += data[j];
      count++;
    }

    result[i] = sum / count;
  }

  return result;
}

export function calculateSlope(data: number[], windowSize: number = 10): number[] {
  const slopes: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length - 1, i + halfWindow);

    if (start === end) {
      slopes.push(0);
    } else {
      const slope = (data[end] - data[start]) / (end - start);
      slopes.push(slope);
    }
  }

  return slopes;
}

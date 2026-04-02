import savitzkyGolay from 'ml-savitzky-golay';

export function smoothSeries(data: number[], windowSize: number): number[] {
  if (windowSize % 2 === 0) {
    throw new Error(`Window size must be odd, got ${windowSize}`);
  }
  if (windowSize > data.length) {
    throw new Error(`Window size ${windowSize} exceeds data length ${data.length}`);
  }

  const smoothed = savitzkyGolay(data, 1, { windowSize, polynomial: 2 });
  return Array.from(smoothed);
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

import * as fs from 'fs';
import { classifyStates, computeSessionMetrics } from './src/utils/sessionMetrics';
import type { TimeSeries } from './src/types';

function parseCSV(filePath: string): TimeSeries[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);

  const timeSeries: TimeSeries[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const [x_str, y_str] = lines[i].split(',');
    if (!x_str || !y_str) break; // Stop at empty rows

    const x = parseFloat(x_str);
    const y = parseFloat(y_str);

    if (isNaN(x) || isNaN(y)) break;

    // Assume 50ms sampling interval
    timeSeries.push({
      t: (i - 1) * 50,
      x,
      y,
      r: 0, // rotation not in data
    });
  }

  return timeSeries;
}

function analyzeSegmentation(fileName: string, timeSeries: TimeSeries[]) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analysis of ${fileName}`);
  console.log(`${'='.repeat(60)}`);

  // Calculate deviation and basic stats
  const deviations = timeSeries.map(ts => Math.sqrt(ts.x * ts.x + ts.y * ts.y));
  const minDev = Math.min(...deviations);
  const maxDev = Math.max(...deviations);
  const avgDev = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const sessionDuration = (timeSeries.length - 1) * 50 / 1000; // Convert to seconds

  console.log(`\nSession Stats:`);
  console.log(`  Duration: ${sessionDuration.toFixed(2)}s`);
  console.log(`  Data points: ${timeSeries.length}`);
  console.log(`  Deviation - Min: ${minDev.toFixed(2)}cm, Max: ${maxDev.toFixed(2)}cm, Avg: ${avgDev.toFixed(2)}cm`);

  // Run segmentation with different thresholds
  const thresholds = [0.5, 1.0, 1.5, 2.0];

  for (const threshold of thresholds) {
    const segments = classifyStates(timeSeries, threshold, 'deviation');

    console.log(`\n--- Threshold: ${threshold}cm ---`);
    console.log(`Total segments: ${segments.length}`);

    const stateCount: Record<string, number> = {};
    segments.forEach(seg => {
      stateCount[seg.state] = (stateCount[seg.state] || 0) + 1;
    });

    console.log(`State breakdown:`);
    Object.entries(stateCount).forEach(([state, count]) => {
      console.log(`  ${state}: ${count}`);
    });

    // Analyze segment details
    console.log(`\nSegment details:`);
    segments.forEach((seg, idx) => {
      const durationMs = seg.endTime - seg.startTime;
      const durationS = durationMs / 1000;
      const startIdx = Math.round(seg.startTime / 50);
      const endIdx = Math.round(seg.endTime / 50);
      const segDeviations = deviations.slice(startIdx, endIdx + 1);
      const segMinDev = Math.min(...segDeviations);
      const segMaxDev = Math.max(...segDeviations);
      const segAvgDev = segDeviations.reduce((a, b) => a + b, 0) / segDeviations.length;

      console.log(`  [${idx}] ${seg.state.padEnd(20)} | ` +
        `${durationS.toFixed(2)}s | ` +
        `Dev: ${segMinDev.toFixed(2)}-${segMaxDev.toFixed(2)}cm (avg ${segAvgDev.toFixed(2)}cm)` +
        (seg.metrics ? ` | slope: ${seg.metrics.intraSegmentSlope.toFixed(3)} cm/s` : ''));
    });
  }
}

// Main
console.log('Real Data Segmentation Analysis');
console.log('================================');

const file1 = parseCSV('/workspace/test_data/1.csv');
const file2 = parseCSV('/workspace/test_data/2.csv');

analyzeSegmentation('test_data/1.csv', file1);
analyzeSegmentation('test_data/2.csv', file2);

console.log(`\n${'='.repeat(60)}`);
console.log('Analysis Complete');
console.log(`${'='.repeat(60)}\n`);

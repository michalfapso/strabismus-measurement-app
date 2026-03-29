/**
 * Time formatting utilities for converting milliseconds to human-readable time strings
 */

/**
 * Format time in milliseconds to seconds string with 2 decimal places
 * @param milliseconds Time in milliseconds
 * @returns Formatted string like "0.05s", "1.23s", "45.67s"
 */
export function formatTimeSeconds(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  return `${seconds.toFixed(2)}s`;
}

/**
 * Format time value for tooltips/labels (verbose)
 * @param milliseconds Time in milliseconds
 * @returns Formatted string like "0.05 seconds", "1.23 seconds"
 */
export function formatTimeSecondsVerbose(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  return `${seconds.toFixed(2)} seconds`;
}

/**
 * Create a formatter function for recharts (returns a function that recharts calls)
 * @returns Function that takes milliseconds and returns formatted string
 */
export function getTimeFormatter() {
  return (milliseconds: number) => formatTimeSeconds(milliseconds);
}

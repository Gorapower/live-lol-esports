/**
 * Utility functions for handling timestamps and frame indexing
 */

/**
 * Rounds a date down to the previous 10-second boundary
 * @param date The date to round
 * @returns A new Date rounded down to the previous 10-second boundary
 */
export function roundToPrevious10s(date: Date): Date {
  const rounded = new Date(date);
  rounded.setMilliseconds(0);
  
  if (rounded.getSeconds() % 10 !== 0) {
    rounded.setSeconds(rounded.getSeconds() - (rounded.getSeconds() % 10));
  }
  
  return rounded;
}

/**
 * Converts a Date to an ISO8601 string
 * @param date The date to convert
 * @returns ISO8601 string representation with .000Z format
 */
export function toISO(date: Date): string {
  const isoString = date.toISOString();
  return isoString.replace(/\.\d+Z$/, '.000Z');
}

/**
 * Converts an ISO8601 string to epoch milliseconds
 * @param iso The ISO8601 string to convert
 * @returns Epoch milliseconds
 */
export function isoToEpoch(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Converts any timestamp (Date or string) to epoch milliseconds
 * @param timestamp The timestamp to convert
 * @returns Epoch milliseconds
 */
export function toEpochMillis(timestamp: Date | string): number {
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  return new Date(timestamp).getTime();
}

/**
 * Finds the closest timestamp in an array to a target timestamp
 * @param timestamps Sorted array of timestamps
 * @param targetTimestamp Target timestamp to find closest match for
 * @returns Index of the closest timestamp
 */
export function findClosestTimestampIndex(timestamps: number[], targetTimestamp: number): number {
  if (timestamps.length === 0) return -1;
  
  // If target is before the first timestamp, return 0
  if (targetTimestamp <= timestamps[0]) return 0;
  
  // If target is after the last timestamp, return last index
  if (targetTimestamp >= timestamps[timestamps.length - 1]) return timestamps.length - 1;
  
  // Binary search for the closest timestamp
  let left = 0;
  let right = timestamps.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = timestamps[mid];
    
    if (midTimestamp === targetTimestamp) {
      return mid;
    } else if (midTimestamp < targetTimestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  // At this point, right < left and target is between timestamps[right] and timestamps[left]
  // Return whichever is closer
  const leftDiff = Math.abs(timestamps[left] - targetTimestamp);
  const rightDiff = Math.abs(timestamps[right] - targetTimestamp);
  
  return leftDiff < rightDiff ? left : right;
}

/**
 * Checks if a gameState indicates the match is finished/completed
 * @param gameState The gameState string from the API
 * @returns true if the game is in a terminal state
 */
export function isTerminalGameState(gameState: string): boolean {
  if (!gameState) return false;
  
  const terminalStates = [
    'finished',
    'completed',
    'postgame',
    'post_game'
  ];
  
  return terminalStates.includes(gameState.toLowerCase());
}
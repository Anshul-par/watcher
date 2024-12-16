export const MOST_TIMEOUT_COUNT = 5;
export const MOST_ERROR_COUNT = 3;
export const LEAST_CRON_SCHEDULE = 300; // 5 minutes

export function decreasingBackoff({
  retryCount,
  maxRetryCount,
  initialDelay,
}: {
  retryCount: number;
  maxRetryCount: number;
  initialDelay: number;
}): number {
  if (retryCount >= maxRetryCount) {
    return LEAST_CRON_SCHEDULE;
  }
  const delay = initialDelay / (retryCount + 1);
  return Math.max(delay, LEAST_CRON_SCHEDULE);
}

// export const MOST_TIMEOUT_COUNT = 2;
// export const MOST_ERROR_COUNT = 2;
// export const LEAST_CRON_SCHEDULE = 300; // 5 minutes

// export function decreasingBackoff({
//   retryCount,
//   maxRetryCount,
//   initialDelay,
// }: {
//   retryCount: number;
//   maxRetryCount: number;
//   initialDelay: number;
// }): number {
//   if (retryCount >= maxRetryCount) {
//     return LEAST_CRON_SCHEDULE;
//   }
//   const delay = initialDelay / (retryCount + 2);
//   return Math.max(delay, LEAST_CRON_SCHEDULE);
// }

export const MOST_ERROR_COUNT = 2;
export const LEAST_CRON_SCHEDULE = 300; // 5 minutes
export const MAX_CRON_SCHEDULE = 3600; // 60 minutes

export const ERROR_THRESHOLD_MS = 30 * 60 * 1000;

export function calculateDynamicBackoff({
  retryCount,
  maxRetryCount,
  initialDelay,
  lastErrorTime,
  latestErrorTime,
}: {
  retryCount: number;
  maxRetryCount: number;
  initialDelay: number;
  lastErrorTime: number;
  latestErrorTime: number;
}): number {
  const timeDiff = Math.abs(latestErrorTime - lastErrorTime);

  let delay;
  if (timeDiff > ERROR_THRESHOLD_MS) {
    delay = initialDelay * 1.5;
  } else {
    if (retryCount >= maxRetryCount) {
      delay = LEAST_CRON_SCHEDULE;
    } else {
      delay = initialDelay / (retryCount + 2);
    }
  }

  return Math.min(Math.max(delay, LEAST_CRON_SCHEDULE), MAX_CRON_SCHEDULE);
}

export const analyzeErrorTiming = (latestResponse) => {
  if (!latestResponse || latestResponse.length < 2) return false;

  const errors = latestResponse
    .filter(
      (entry) => entry.isSuccess === "false" || entry.isTimeout === "true"
    )
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  if (errors.length < 2) return false;

  const [latestError, previousError] = errors;
  const timeDiff = Math.abs(
    Number(latestError.timestamp) - Number(previousError.timestamp)
  );

  return timeDiff <= ERROR_THRESHOLD_MS;
};

export const MAX_ARRAY_LENGTH = 62;

export const LEAST_CRON_SCHEDULE = 300; // 5 minutes
export const MAX_CRON_SCHEDULE = 3600; // 60 minutes

export const MOST_ERROR_COUNT = 2;
export const ERROR_THRESHOLD_MS = 10;

export const calculateDynamicBackoff = (
  jobRuns,
  currentInterval,
  minInterval = LEAST_CRON_SCHEDULE,
  maxInterval = MAX_CRON_SCHEDULE
) => {
  let newInterval = Number(currentInterval);

  const recentErrors = [];
  for (let i = jobRuns.length - 1; i >= 0; i--) {
    if (jobRuns[i].isSuccess !== "true") {
      recentErrors.push(jobRuns[i]);
      if (recentErrors.length === 2) break;
    }
  }
  if (recentErrors.length && recentErrors.length <= 2) {
    const timeBetweenErrors =
      recentErrors?.[0]?.timestamp - recentErrors?.[1]?.timestamp;

    if (timeBetweenErrors >= currentInterval || !Boolean(timeBetweenErrors)) {
      newInterval *= 0.5; // Decrease by half
    }
  }

  let latestError = null;
  for (let i = jobRuns.length - 1; i >= 0; i--) {
    if (jobRuns[i].isSuccess !== "true") {
      latestError = jobRuns[i];
      break;
    }
  }
  if (latestError) {
    let latestSuccessAfterError = null;
    for (let i = jobRuns.length - 1; i >= 0; i--) {
      if (
        jobRuns[i].isSuccess === "true" &&
        jobRuns[i].timestamp > latestError.timestamp
      ) {
        latestSuccessAfterError = jobRuns[i];
        break;
      }
    }

    if (latestSuccessAfterError) {
      console.log("latestSuccessAfterError", latestSuccessAfterError);
      const timeDiff =
        latestSuccessAfterError.timestamp - latestError.timestamp;
      console.log("timeDiff", timeDiff, currentInterval);
      const ratio = timeDiff / currentInterval;
      console.log("ratio", ratio);
      if (ratio >= 1) {
        // Base increment is 50%, additional increment scales with how much ratio exceeds 1
        const additionalIncrement = Math.min(1, (ratio - 1) / 2);
        const incrementFactor = 2.5 + additionalIncrement;
        newInterval *= incrementFactor;
        console.log(`Increase by ${(incrementFactor - 1) * 100}%`, newInterval);
      }
    }
  }

  return Math.max(minInterval, Math.min(newInterval, maxInterval));
};

export const analyzeErrorTiming = (jobRuns) => {
  // Handle empty array or single element (no adjacent pairs)
  if (jobRuns.length < 2) {
    return false;
  }

  for (let i = 0; i < jobRuns.length - 1; i++) {
    if (
      jobRuns[i].isSuccess !== "true" &&
      jobRuns[i + 1].isSuccess !== "true"
    ) {
      return true; // Found two adjacent errors
    }
  }
  return false; // No adjacent errors found
};

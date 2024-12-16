import {
  decreasingBackoff,
  MOST_ERROR_COUNT,
  MOST_TIMEOUT_COUNT,
} from "../constants";
import { createHealth } from "../services/health.service";
import { addJobService } from "../services/jobs.service";
import { findUrl } from "../services/url.service";
import { convertValuesToStrings } from "./convertValuesToString";
import { performUrlHealthCheck } from "./performHealthCheck";
import { redisClient, redisClientDuplicate } from "./startServer";

/**
 * Subscribes to Redis notifications for expired keys and processes them based on their type.
 * Handles two types of keys:
 * - "delete-*": Represents keys that require saving data to the database before being deleted.
 * - "shadow-*": Represents keys for scheduling and managing periodic health checks.
 */
export const subscribeToNotifications = () => {
  // Ensure the duplicate Redis client is initialized and connected.
  if (!redisClientDuplicate) {
    console.error("Redis client not initialized or is not connected.");
    return;
  }

  console.log("--Subscribed to Notifications--");

  // Subscribe to Redis key expiration events.
  redisClientDuplicate.subscribe(
    "__keyevent@0__:expired",
    async (key: string) => {
      try {
        console.log(`Processing expired key: ${key}`);
        // Handle "delete-*" keys: Save data to the database and cleanup.
        if (key.includes("delete")) {
          const originalKey = key.replace("delete-", ""); // Remove "delete-" prefix to get the original key.
          const [_, urlId] = originalKey.replace("cron-", "").split("-"); // Extract URL ID.

          const shadowKey = `shadow-${originalKey}`;
          await redisClient.del(shadowKey); // Delete the associated shadow key.

          // Fetch all data associated with the key.
          const { latestResponse, ...dataTobeSaved } =
            await redisClient.hGetAll(`${originalKey}`);

          // Save the key data to the database.
          //@ts-ignore
          await createHealth({
            ...dataTobeSaved,
            latestResponse: JSON.parse(latestResponse), // Parse the latest response as JSON.
            //@ts-ignore
            url: urlId,
          });

          console.log(`Saved data for URL: ${urlId}`);

          const numberOfTimeouts = await redisClient.hGet(
            originalKey,
            "numberOfTimeouts"
          );
          const numberOfRetries = await redisClient.hGet(
            originalKey,
            "numberOfRetries"
          );

          const isRetryAble = !(
            Number(numberOfTimeouts) >= MOST_TIMEOUT_COUNT ||
            Number(numberOfRetries) >= MOST_ERROR_COUNT
          );

          // Delete the original key from Redis.
          await redisClient.del(`${originalKey}`);
          console.log(`Deleted key: ${originalKey}`);

          if (!isRetryAble) {
            console.log(
              `Max retries or timeouts reached for URL: ${urlId} thats why not re-adding to the job`
            );
            return;
          }
          // Find the URL data from the database using the URL ID.
          const url_data = await findUrl({
            query: { _id: urlId },
          });

          // Re-add the job for the URL to the processing queue.
          //@ts-ignore
          await addJobService({ url_data: url_data[0] });
        }

        // Handle "shadow-*" keys: Perform health checks and reschedule.
        if (key.includes("shadow")) {
          const originalKey = key.replace("shadow-", ""); // Remove "shadow-" prefix to get the original key.

          // If the original key represents a cron job.
          if (originalKey.includes("cron")) {
            const [projectId, urlId] = originalKey
              .replace("cron-", "")
              .split("-"); // Extract project ID and URL ID.

            // Find the corresponding URL data in the database.
            const urlData = await findUrl({
              query: { project: projectId, _id: urlId },
            });

            // Handle case where URL data is not found.
            if (urlData.length === 0) {
              console.error(
                `URL not found for project: ${projectId} and URL ID: ${urlId}`
              );
              return;
            }

            console.log(
              `Processing job for project: ${projectId} and URL ID: ${urlId}`
            );

            // Prepare the URL data for processing, defaulting to "GET" method if not defined.
            const urlDataToBeProcessed = {
              ...urlData[0],
              method: urlData[0].method || "GET",
            };

            // Perform a health check on the URL.
            const health = await performUrlHealthCheck(urlDataToBeProcessed);

            // Fetch the current state of the original key in Redis.
            const response = await redisClient.hGetAll(originalKey);

            // Record the inspection time.
            const inspection_time = new Date().toISOString();
            health["inspection_time"] = inspection_time;

            // Increment the number of cron runs.
            await redisClient.hIncrBy(originalKey, "numberOfCronruns", 1);

            // Update the latest response in Redis.
            await redisClient.hSet(
              originalKey,
              "latestResponse",
              JSON.stringify([
                ...JSON.parse(response.latestResponse).map((r) =>
                  convertValuesToStrings(r)
                ),
                convertValuesToStrings(health),
              ])
            );

            // Update counters for timeouts or retries based on the health check results.
            if (health.isTimeout) {
              await redisClient.hIncrBy(originalKey, "numberOfTimeouts", 1);
            }
            if (!health.isSuccess && !health.isTimeout) {
              await redisClient.hIncrBy(originalKey, "numberOfRetries", 1);
            }

            // Adjust the cron schedule based on retries and timeouts using backoff logic.
            const numberOfTimeouts = await redisClient.hGet(
              originalKey,
              "numberOfTimeouts"
            );
            const numberOfRetries = await redisClient.hGet(
              originalKey,
              "numberOfRetries"
            );
            const cronSchedule = await redisClient.hGet(
              originalKey,
              "cronSchedule"
            );

            if (
              Number(numberOfTimeouts) >= MOST_TIMEOUT_COUNT ||
              Number(numberOfRetries) >= MOST_ERROR_COUNT
            ) {
              console.log(
                `Max retries or timeouts reached for project: ${projectId} and URL ID: ${urlId}`
              );
              // TODO -------------------> send to dead letter queue
              await redisClient.del(`shadow-${originalKey}`); // Delete the associated shadow key to stop the cron job
              console.log(`Deleted shadow key: shadow-${originalKey}`);
              await redisClient.expire(`delete-${originalKey}`, 5); // Expire the key to remove it from the processing queue and save data to DB
              console.log(`Expired delete key: delete-${originalKey}`);
              return;
            }

            if (Number(numberOfTimeouts) > 0 || Number(numberOfRetries) > 0) {
              const newCronSchedule = decreasingBackoff({
                retryCount: Number(numberOfRetries) || Number(numberOfTimeouts),
                maxRetryCount:
                  Number(numberOfTimeouts) > 0
                    ? MOST_TIMEOUT_COUNT
                    : MOST_ERROR_COUNT,
                initialDelay: Number(cronSchedule),
              });

              // Reschedule the next job with the adjusted delay.
              const shadowKey = `shadow-${originalKey}`;
              await redisClient.set(shadowKey, 1, {
                EX: newCronSchedule,
              });

              console.log(
                `Rescheduled job for project: ${projectId} and URL ID: ${urlId} with delay: ${newCronSchedule}`
              );

              await redisClient.hSet(
                originalKey,
                "cronSchedule",
                newCronSchedule
              );

              return;
            }

            // Reschedule the next job with the default cron schedule.
            const shadowKey = `shadow-${originalKey}`;
            await redisClient.set(shadowKey, 1, {
              EX: urlDataToBeProcessed.cronSchedule,
            });
          }
        }
      } catch (error) {
        // Log any errors encountered during processing.
        console.error(`Error processing expired key: ${key}`, error);
      }
    }
  );
};

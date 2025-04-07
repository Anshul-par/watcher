import {
  publishToDeleteQueue,
  publishToJobLetterQueue,
  publishToExternalTestQueue,
  publishToReminderQueue,
} from "../broker";
import { redisClientDuplicate } from "./startServer";

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
          publishToDeleteQueue(Buffer.from(key));
        }

        // Handle "shadow-*" keys: Perform health checks and reschedule.
        if (key.includes("shadow")) {
          publishToJobLetterQueue(Buffer.from(key));
        }

        // Handle other types of keys as needed.
        if (key.includes("external-test")) {
          publishToExternalTestQueue(Buffer.from(key));
        }

        if (key.includes("reminder")) {
          publishToReminderQueue(Buffer.from(key));
        }
      } catch (error) {
        // Log any errors encountered during processing.
        console.error(`Error processing expired key: ${key}`, error);
      }
    }
  );
};

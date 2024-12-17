import { findUrl } from "../services/url.service";
import { redisClientDuplicate } from "./startServer";

export const subscribeToNotifications = () => {
  if (!redisClientDuplicate) {
    console.error("Redis client not initialized or is not connected.");
    return;
  }

  console.log("--Subscribed to Notifications--");
  redisClientDuplicate.subscribe(
    "__keyevent@0__:expired",
    async (key: string) => {
      try {
        if (key.includes("shadow")) {
          const originalKey = key.replace("shadow-", "");
          if (originalKey.includes("cron")) {
            // `cron-${url_data.project}-${url_data._id}`
            const [projectId, urlId] = originalKey
              .replace("cron-", "")
              .split("-");

            const urlData = await findUrl({
              query: { project: projectId, _id: urlId },
            });

            if (urlData.length === 0) {
              console.error(
                `URL not found for project: ${projectId} and urlId: ${urlId}`
              );
              return;
            }

            console.log(
              `Processing job for project: ${projectId} and urlId: ${urlId}`
            );
            const urlDataToBeProcessed = {
              ...urlData[0],
              method: urlData[0].method || "GET", // Default to "GET" if method is not defined
            };
          }
        }
      } catch (error) {
        console.error(`Error processing expired key: ${key}`, error);
      }
    }
  );
};

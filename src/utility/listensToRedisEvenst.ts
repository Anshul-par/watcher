import { createHealth } from "../services/health.service";
import { addJobService } from "../services/jobs.service";
import { findUrl } from "../services/url.service";
import { convertValuesToStrings } from "./convertValuesToString";
import { performUrlHealthCheck } from "./performHealthCheck";
import { redisClient, redisClientDuplicate } from "./startServer";

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
        if (key.includes("delete")) {
          const originalKey = key.replace("delete-", "");
          const [_, urlId] = originalKey.replace("cron-", "").split("-");

          const shadowKey = `shadow-${originalKey}`;
          await redisClient.del(shadowKey);

          const { latestResponse, ...dataTobeSaved } =
            await redisClient.hGetAll(`${originalKey}`);

          // Remove unwanted fields
          delete dataTobeSaved.createdAt;
          delete dataTobeSaved.updatedAt;

          // Save the data to the database
          //@ts-ignore
          await createHealth({
            ...dataTobeSaved,
            latestResponse: JSON.parse(latestResponse),
            //@ts-ignore
            url: urlId,
          });

          console.log(`Saved data for url: ${urlId}`);

          await redisClient.del(`${originalKey}`);
          console.log(`Deleted key: ${originalKey}`);

          const url_data = await findUrl({
            query: { _id: urlId },
          });

          console.log(url_data);

          //@ts-ignore
          await addJobService(url_data[0]);
        }
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

            // TODO  ---------->  Add job to the queue
            const health = await performUrlHealthCheck(urlDataToBeProcessed);
            const response = await redisClient.hGetAll(originalKey);

            const inspection_time = new Date().toISOString();
            health["inspection_time"] = inspection_time;

            await redisClient.hIncrBy(originalKey, "numberOfCronruns", 1);

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

            if (health.isTimeout) {
              await redisClient.hIncrBy(originalKey, "numberOfTimeouts", 1);
            }

            if (!health.isSuccess) {
              await redisClient.hIncrBy(originalKey, "numberOfRetries", 1);
            }

            // Schedule the next job
            const shadowKey = `shadow-${originalKey}`;
            await redisClient.set(shadowKey, 1, {
              EX: urlDataToBeProcessed.cronSchedule,
            });
          }
        }
      } catch (error) {
        console.error(`Error processing expired key: ${key}`, error);
      }
    }
  );
};

import amqplib from "amqplib";
import { sleep } from "../utility/sleep";
import { WebClient } from "@slack/web-api";
import { redisClient } from "../utility/startServer";
import {
  analyzeErrorTiming,
  calculateDynamicBackoff,
  MOST_ERROR_COUNT,
} from "../constants";
import { performUrlHealthCheck } from "../utility/performHealthCheck";
import { findUrl, updateUrl } from "../services/url.service";
import { URLModel } from "../models/url.model";
import { UserModel } from "../models/user.model";
import { TimezoneService } from "../services/timezone.service";
import { createHealth } from "../services/health.service";
import { restartJobAfterDeletion } from "../services/jobs.service";
import { acquireLock } from "../utility/acquireLock";
import { convertValuesToStrings } from "../utility/convertValuesToString";
import { safeJsonParse } from "../utility/safeJSONParse";

let connectionToRabbitMQ: amqplib.Connection = null;

let deadLetterChannel: amqplib.Channel = null;
let deleteChannel: amqplib.Channel = null;
let jobChannel: amqplib.Channel = null;

let DEAD_LETTER_QUEUE = "dead_url_queue";
let DELETE_QUEUE = "delete_url_queue";
let JOB_QUEUE = "job_url_queue";

const web = new WebClient(process.env.SLACK_TOKEN);

export const connectToRabbitMQ = async () => {
  let retries = 0;
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 2000;

  while (retries < MAX_RETRIES) {
    try {
      // amqp://<username>:<password>@<host>:<port>
      connectionToRabbitMQ = await amqplib.connect(process.env.RABBITMQ_URL);
      console.log("--RabbitMQ Connected--");
      await createdeadLetterChannel();
      await createJobChannel();
      await createDeleteChannel();
      break;
    } catch (error) {
      console.log(`Error while connecting to RabbitMQ: ${error}`);
      retries++;
      sleep(RETRY_DELAY * retries);
      if (retries < MAX_RETRIES) {
        console.log(`Retrying connection (${retries}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * retries);
      } else {
        console.log("Max retries reached. Could not connect to RabbitMQ.");
        throw error;
      }
    }
  }
};

const createdeadLetterChannel = async () => {
  try {
    deadLetterChannel = await connectionToRabbitMQ.createChannel();

    await deadLetterChannel.assertQueue(DEAD_LETTER_QUEUE, {
      durable: true,
    });
    consumerForDeadLettersQueue();
  } catch (error) {
    console.log(`Error while creating dead url channel to RabbitMQ ${error}`);
  }
};

const createJobChannel = async () => {
  try {
    jobChannel = await connectionToRabbitMQ.createChannel();

    await jobChannel.assertQueue(JOB_QUEUE, {
      durable: true,
    });
    await consumerForJobQueue();
  } catch (error) {
    console.log(`Error while creating jobs channel to RabbitMQ ${error}`);
  }
};

const createDeleteChannel = async () => {
  try {
    deleteChannel = await connectionToRabbitMQ.createChannel();

    await deleteChannel.assertQueue(DELETE_QUEUE, {
      durable: true,
    });
    await consumerForDeleteQueue();
  } catch (error) {
    console.log(`Error while creating delete channel to RabbitMQ ${error}`);
  }
};

export const publishToJobLetterQueue = async (data: Buffer) => {
  try {
    jobChannel.sendToQueue(JOB_QUEUE, data);
  } catch (error) {
    console.log(`Error while publishing to JOB_QUEUE queue ${error}`);
  }
};

export const publishToDeadLetterQueue = async (data: Buffer) => {
  try {
    deadLetterChannel.sendToQueue(DEAD_LETTER_QUEUE, data);
  } catch (error) {
    console.log(`Error while publishing to DEAD_LETTER_QUEUE queue ${error}`);
  }
};

export const publishToDeleteQueue = async (data: Buffer) => {
  try {
    deleteChannel.sendToQueue(DELETE_QUEUE, data);
  } catch (error) {
    console.log(`Error while publishing to DELETE_QUEUE queue ${error}`);
  }
};

export const consumerForDeadLettersQueue = () => {
  console.log("----Consumer for Dead_Letter_Queue started----");
  deadLetterChannel.prefetch(1); // process only one message at a time from the queue
  deadLetterChannel.consume(DEAD_LETTER_QUEUE, async (message) => {
    try {
      if (message !== null) {
        const data = message.content;
        let urlId = data.toString();

        if (urlId.includes("delete-cron-")) {
          urlId = urlId.replace("delete-cron-", "").split("-")[1]; // Extract URL ID.
        }

        console.log(`Processing message from dead letter queue:`, urlId);

        const urlDetails = await URLModel.findById(urlId).populate({
          path: "project",
        });

        if (!urlDetails || !urlDetails.project) {
          console.log(`URL or project not found for ID: ${urlId}`);
          deadLetterChannel.ack(message);
          return;
        }

        let owner = null;

        const fallback_user = await UserModel.findOne({
          title: "Boss",
        });

        //@ts-ignore
        if (urlDetails.project.owner) {
          //@ts-ignore
          owner = await UserModel.findById(urlDetails.project.owner);
        } else {
          owner = fallback_user;
        }

        // Make sure project object is not null before setting owner
        if (urlDetails.project) {
          //@ts-ignore
          urlDetails.project.owner = owner;
        }

        await sendMessageToSlack(urlDetails);

        deadLetterChannel.ack(message);

        console.log(`Received message from dead letter queue`);
      }
    } catch (error) {
      console.log(`Error while consuming from Dead_Letter_Queue ${error}`);
      deadLetterChannel.nack(message, false, true);
    }
  });
};

export const consumerForDeleteQueue = () => {
  console.log("----Consumer for Delete_Queue started----");

  deleteChannel.prefetch(1);
  deleteChannel.consume(DELETE_QUEUE, async (message) => {
    let lockKey = null;
    try {
      if (message !== null) {
        const data = message.content;
        const parsedData = data.toString();
        console.log(`Processing message from delete queue:`, parsedData);

        const originalKey = parsedData.replace("delete-", "");
        const [_, urlId] = originalKey.replace("cron-", "").split("-");

        lockKey = `lock:${urlId}`;
        const lockAcquired = await acquireLock({ lockKey });

        if (!lockAcquired) {
          console.log(
            `Failed to acquire lock for URL ID: ${urlId} after retries. Requeueing message.`
          );
          deleteChannel.nack(message, false, true);
          return;
        }

        console.log(`Successfully acquired lock for URL ID: ${urlId}`);

        const shadowKey = `shadow-${originalKey}`;
        await redisClient.del(shadowKey);

        const latestData = await redisClient.hGetAll(`${originalKey}`);

        if (
          !latestData ||
          !Object.keys(JSON.parse(JSON.stringify(latestData))).length
        ) {
          console.log(`key ${originalKey} has been already processed`);
          deleteChannel.ack(message);
          await redisClient.del(lockKey);
          return;
        }

        const { latestResponse, ...dataTobeSaved } = latestData;
        let parsedJson = safeJsonParse(latestResponse, []);

        //@ts-ignore
        await createHealth({
          ...dataTobeSaved,
          unix: TimezoneService.getCurrentTimestamp(),
          latestResponse: parsedJson,
          url: urlId,
        });

        console.log(`Saved data for URL: ${urlId}`);

        const numberOfRetries = await redisClient.hGet(
          originalKey,
          "numberOfRetries"
        );

        const isRetryAble = !(Number(numberOfRetries) >= MOST_ERROR_COUNT);

        await redisClient.del(`${originalKey}`);
        console.log(`Deleted key: ${originalKey}`);

        if (!isRetryAble) {
          console.log(
            `Max retries or timeouts reached for URL: ${urlId} thats why not re-adding to the job`
          );
          deleteChannel.ack(message);
          await redisClient.del(lockKey);
          await updateUrl({
            query: { _id: urlId },
            update: { inProcess: false },
          });
          return;
        }

        const url_data = await findUrl({
          query: { _id: urlId },
        });

        console.log(`Found URL data for URL: ${urlId} with data:`, url_data);

        if (url_data && url_data.length > 0) {
          // @ts-ignore
          await restartJobAfterDeletion({ url_data: url_data[0] });
        }

        await redisClient.del(lockKey);
        deleteChannel.ack(message);
        console.log(`acknowledged message from delete queue:`, parsedData);
      }
    } catch (error) {
      console.log(`Error while consuming from Delete_Queue  ${error}`);
      if (lockKey) {
        await redisClient.del(lockKey);
      }
      deleteChannel.nack(message, false, true);
    }
  });
};

export const consumerForJobQueue = () => {
  console.log("----Consumer for Job_Queue started----");

  jobChannel.prefetch(1);
  jobChannel.consume(JOB_QUEUE, async (message) => {
    let lockKey = null;
    try {
      if (message !== null) {
        const data = message.content;
        const parsedData = data.toString();
        const originalKey = parsedData.replace("shadow-", "");

        if (originalKey.includes("cron")) {
          const [projectId, urlId] = originalKey
            .replace("cron-", "")
            .split("-");

          lockKey = `lock:${urlId}`;
          const lockAcquired = await acquireLock({ lockKey });

          if (!lockAcquired) {
            console.log(
              `Failed to acquire lock for URL ID: ${urlId} after retries. Requeueing message.`
            );
            jobChannel.nack(message, false, true);
            return;
          }

          console.log(`Successfully acquired lock for URL ID: ${urlId}`);

          const urlData = await findUrl({ query: { _id: urlId } });

          if (urlData.length === 0) {
            console.error(`URL not found for ID: ${urlId}`);
            jobChannel.ack(message);
            await redisClient.del(lockKey);
            return;
          }

          const urlDataToBeProcessed = {
            ...urlData[0],
            method: urlData[0].method || "GET",
          };

          const health = await performUrlHealthCheck(urlDataToBeProcessed);

          const response = await redisClient.hGetAll(originalKey);

          if (
            !response ||
            !Object.keys(JSON.parse(JSON.stringify(response))).length
          ) {
            console.log(`Key ${originalKey} has been already processed`);
            jobChannel.ack(message);
            await redisClient.del(lockKey);
            return;
          }

          health["inspection_time"] = TimezoneService.formatUnixTimestamp(
            TimezoneService.getCurrentTimestamp()
          );

          await redisClient.hIncrBy(originalKey, "numberOfCronruns", 1);

          const mergedResponse = [
            ...JSON.parse(response.latestResponse),
            convertValuesToStrings(health),
          ];

          await redisClient.hSet(
            originalKey,
            "latestResponse",
            JSON.stringify([
              ...mergedResponse.map((r) => convertValuesToStrings(r)),
            ])
          );

          if (!health.isSuccess) {
            await redisClient.hIncrBy(originalKey, "numberOfRetries", 1);
          }

          const numberOfRetries = await redisClient.hGet(
            originalKey,
            "numberOfRetries"
          );
          const cronSchedule = await redisClient.hGet(
            originalKey,
            "cronSchedule"
          );

          if (Number(numberOfRetries) >= MOST_ERROR_COUNT) {
            const shouldPublish = analyzeErrorTiming(mergedResponse);

            if (shouldPublish) {
              console.log(
                `Max retries or timeouts reached for project: ${projectId} and URL ID: ${urlId}`
              );

              await redisClient.del(`shadow-${originalKey}`); // Delete the associated shadow key to stop the cron job
              console.log(`Deleted shadow key: shadow-${originalKey}`);
              await redisClient.expire(`delete-${originalKey}`, 1); // Expire the key to remove it from the processing queue and save data to DB
              console.log(`Expired delete key: delete-${originalKey}`);

              publishToDeadLetterQueue(Buffer.from(urlId));
              console.log(`Published to Dead_Letter_Queue`);

              jobChannel.ack(message);
              console.log(`Acknowledged message from Job_Queue`);
              return;
            } else {
              console.log(
                `Not publishing to Dead_Letter_Queue for project: ${projectId} and URL ID: ${urlId} as Error difference is less than threshold`
              );
            }
          }

          if (Number(numberOfRetries) > 0) {
            const errors = mergedResponse
              .filter(
                (entry) =>
                  entry.isSuccess === "false" || entry.isTimeout === "true"
              )
              .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

            let lastErrorTime = 0;
            let latestErrorTime = 0;

            if (errors.length > 1) {
              latestErrorTime = Number(errors[0].timestamp);
              lastErrorTime = Number(errors[1].timestamp);
            } else if (errors.length === 1) {
              latestErrorTime = Number(errors[0].timestamp);
              lastErrorTime = latestErrorTime;
            }

            const newCronSchedule = calculateDynamicBackoff({
              retryCount: Number(numberOfRetries),
              maxRetryCount: MOST_ERROR_COUNT,
              initialDelay: Number(cronSchedule),
              lastErrorTime,
              latestErrorTime,
            });

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

            jobChannel.ack(message);
            return;
          }

          const shadowKey = `shadow-${originalKey}`;
          await redisClient.set(shadowKey, 1, {
            EX: urlDataToBeProcessed.cronSchedule,
          });

          await redisClient.del(lockKey);
          jobChannel.ack(message);

          console.log(`Successfully processed URL ID: ${urlId}`);
        }
      }
    } catch (error) {
      console.error(`Error processing message: ${error}`);
      if (lockKey) {
        await redisClient.del(lockKey);
      }
      jobChannel.nack(message, false, true);
      console.error(`Error processing message: ${error}`);
    }
  });
};

export const sendMessageToSlack = async (data: any) => {
  try {
    const channelId = process.env.SLACK_CHANNEL_ID;
    const messageText = messageFormatForSlack(data);

    const result = await web.chat.postMessage({
      channel: channelId,
      text: messageText,
    });

    if (result.ok) {
      console.log("Message SENT on Slack");
    } else {
      console.log("Message NOT_SENT to Slack");
    }
  } catch (error) {
    console.error("Error while sending message on slack", error);
  }
};

export const sendTextMessageToSlack = async (text: any) => {
  try {
    const channelId = process.env.SLACK_CHANNEL_ID;

    const result = await web.chat.postMessage({
      channel: channelId,
      text: text,
    });

    if (result.ok) {
      console.log("Message SENT on Slack");
    } else {
      console.log("Message NOT_SENT to Slack");
    }
  } catch (error) {
    console.error("Error while sending message on slack", error);
  }
};

export const messageFormatForSlack = (data: any) => {
  let messagePayload = `🔴 *Alert! URL Monitoring Notification*\n⚠️ *A URL has gone down*\n\nHey <@${
    data.project.owner.slackUserId
  }>,\nThe monitored URL is currently *unreachable*.\n\n🛠️ *Method:*  ${data.method.toUpperCase()} \n🔗 *URL:* <${
    data.url
  }>\n🕒 *Time:* ${new Date().toLocaleString()}\n------------------------MESSAGE END-----------------------\n\n`;
  return messagePayload;
};

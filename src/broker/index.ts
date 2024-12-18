import amqplib from "amqplib";
import { sleep } from "../utility/sleep";
import { WebClient } from "@slack/web-api";
import { redisClient } from "../utility/startServer";
import {
  decreasingBackoff,
  MOST_ERROR_COUNT,
  MOST_TIMEOUT_COUNT,
} from "../constants";
import { convertValuesToStrings } from "../utility/convertValuesToString";
import { performUrlHealthCheck } from "../utility/performHealthCheck";
import { findUrl } from "../services/url.service";
import { URLModel } from "../models/url.model";

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
    console.log(`Error while creating Location channel to RabbitMQ ${error}`);
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
    console.log(`Error while creating Location channel to RabbitMQ ${error}`);
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
    console.log(`Error while creating Location channel to RabbitMQ ${error}`);
  }
};

export const publishToJobLetterQueue = async (data: Buffer) => {
  try {
    jobChannel.sendToQueue(JOB_QUEUE, data);
  } catch (error) {
    console.log(`Error while publishing to Location queue ${error}`);
  }
};

export const publishToDeadLetterQueue = async (data: Buffer) => {
  try {
    deadLetterChannel.sendToQueue(DEAD_LETTER_QUEUE, data);
  } catch (error) {
    console.log(`Error while publishing to Location queue ${error}`);
  }
};

export const publishToDeleteQueue = async (data: Buffer) => {
  try {
    deleteChannel.sendToQueue(DEAD_LETTER_QUEUE, data);
  } catch (error) {
    console.log(`Error while publishing to Location queue ${error}`);
  }
};

export const consumerForDeadLettersQueue = () => {
  console.log("----Consumer for Dead_Letter_Queue started----");
  deadLetterChannel.prefetch(1); // process only one message at a time from the queue
  deadLetterChannel.consume(DEAD_LETTER_QUEUE, async (message) => {
    try {
      if (message !== null) {
        const data = message.content;
        const urlId = data.toString();

        const urlDetails = await URLModel.findById(urlId).populate({
          path: "project",
          populate: { path: "owner" },
        });

        await sendMessageToSlack(urlDetails);

        deadLetterChannel.ack(message);

        console.log(`Received message from dead letter queue`);
      }
    } catch (error) {
      console.log(`Error while consuming from Dead_Letter_Queue ${error}`);
    }
  });
};

export const consumerForDeleteQueue = () => {
  console.log("----Consumer for Delete_Queue started----");

  deleteChannel.prefetch(1); // process only one message at a time from the queue
  deleteChannel.consume(DELETE_QUEUE, async (message) => {
    try {
      if (message !== null) {
        const data = message.content;
        const parsedData = data.toString();

        const originalKey = parsedData.replace("delete-", ""); // Remove "delete-" prefix to get the original key.
        const [_, urlId] = originalKey.replace("cron-", "").split("-"); // Extract URL ID.

        const shadowKey = `shadow-${originalKey}`;
        await redisClient.del(shadowKey); // Delete the associated shadow key.

        // Fetch all data associated with the key.
        const { latestResponse, ...dataTobeSaved } = await redisClient.hGetAll(
          `${originalKey}`
        );

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

        deleteChannel.ack(message);

        console.log(`Received message from dead letter queue:`, parsedData);
      }
    } catch (error) {
      console.log(`Error while consuming from Delete_Queue  ${error}`);
    }
  });
};

export const consumerForJobQueue = () => {
  console.log("----Consumer for Job_Queue started----");
  jobChannel.prefetch(1); // process only one message at a time from the queue
  jobChannel.consume(JOB_QUEUE, async (message) => {
    try {
      if (message !== null) {
        console.log(`Received message from Job_Queue`);

        const data = message.content;
        const parsedData = data.toString();

        const originalKey = parsedData.replace("shadow-", ""); // Remove "shadow-" prefix to get the original key.

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

          // Prepare the URL data for processing, defaulting to "GET" method if not defined.`
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

            await redisClient.del(`shadow-${originalKey}`); // Delete the associated shadow key to stop the cron job
            console.log(`Deleted shadow key: shadow-${originalKey}`);
            await redisClient.expire(`delete-${originalKey}`, 5); // Expire the key to remove it from the processing queue and save data to DB
            console.log(`Expired delete key: delete-${originalKey}`);

            publishToDeadLetterQueue(Buffer.from(urlId));
            console.log(`Published to Dead_Letter_Queue`);

            jobChannel.ack(message);
            console.log(`Acknowledged message from Job_Queue`);
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

            jobChannel.ack(message);
            return;
          }

          // Reschedule the next job with the default cron schedule.
          const shadowKey = `shadow-${originalKey}`;
          await redisClient.set(shadowKey, 1, {
            EX: urlDataToBeProcessed.cronSchedule,
          });
        }

        jobChannel.ack(message);
      }
    } catch (error) {
      console.log(`Error while consuming from Job_Queue ${error}`);
    }
  });
};

export const deleteQueue = async (queueName: string) => {
  try {
    await deadLetterChannel.deleteQueue(queueName);
  } catch (error) {
    console.log(`Error while deleting queue ${error}`);
  }
};

export const closeRabbitMQConnection = async () => {
  try {
    await deadLetterChannel.close();
    await connectionToRabbitMQ.close();
    console.log("--RabbitMQ Connection Closed--");
  } catch (error) {
    console.log(`Error while closing RabbitMQ connection ${error}`);
  }
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

export const messageFormatForSlack = (data: any) => {
  let messagePayload = `🔴 *Alert! URL Monitoring Notification*\n⚠️ *A URL has gone down*\n\nHey <@${
    data.project.owner.slackUserId
  }>,\nThe monitored URL is currently *unreachable*.\n\n🛠️ *Method:*  ${data.method.toUpperCase()} \n🔗 *URL:* <${
    data.url
  }>\n🕒 *Time:* ${new Date().toLocaleString()}\n------------------------MESSAGE END-----------------------\n\n`;
  return messagePayload;
};

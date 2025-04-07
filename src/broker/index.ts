import amqplib from "amqplib";
import { sleep } from "../utility/sleep";
import { WebClient } from "@slack/web-api";
import { redisClient } from "../utility/startServer";
import {
  analyzeErrorTiming,
  calculateDynamicBackoff,
  MAX_ARRAY_LENGTH,
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
import { performHealthCheckViaExternalServer } from "../utility/performHealthCheckViaExternalServer";
import { createIncident } from "../services/incident.service";

let connectionToRabbitMQ: amqplib.Connection = null;

let deadLetterChannel: amqplib.Channel = null;
let deleteChannel: amqplib.Channel = null;
let jobChannel: amqplib.Channel = null;
let externalTestChannel: amqplib.Channel = null;
let reminderChannel: amqplib.Channel = null;

let DEAD_LETTER_QUEUE = "dead_url_queue";
let DELETE_QUEUE = "delete_url_queue";
let JOB_QUEUE = "job_url_queue";
let EXTERNAL_TEST_QUEUE = "external_test_queue";
let REMINDER_QUEUE = "reminder_queue";

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
      await Promise.all([
        createdeadLetterChannel(),
        createJobChannel(),
        createDeleteChannel(),
        createExternalTestChannel(),
        createReminderChannel(),
      ]);
      break;
    } catch (error) {
      console.log(`Error while connecting to RabbitMQ: ${error}`);
      retries++;
      sleep(RETRY_DELAY * retries);
      console.log(`Error while connecting to RabbitMQ: ${error}`);
      retries++;
      sleep(RETRY_DELAY * retries);
      if (retries < MAX_RETRIES) {
        console.log(`Retrying connection (${retries}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * retries);
        console.log(`Retrying connection (${retries}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * retries);
      } else {
        console.log("Max retries reached. Could not connect to RabbitMQ.");
        throw error;
        console.log("Max retries reached. Could not connect to RabbitMQ.");
        throw error;
      }
    }
  }
};

// CHANNELS

const createReminderChannel = async () => {
  try {
    reminderChannel = await connectionToRabbitMQ.createChannel();

    await reminderChannel.assertQueue(REMINDER_QUEUE, {
      durable: true,
    });
    consumerForReminderQueue();
  } catch (error) {
    console.log(`Error while creating dead url channel to RabbitMQ ${error}`);
  }
};

const createExternalTestChannel = async () => {
  try {
    externalTestChannel = await connectionToRabbitMQ.createChannel();

    await externalTestChannel.assertQueue(EXTERNAL_TEST_QUEUE, {
      durable: true,
    });
    consumerForExternalTestQueue();
  } catch (error) {
    console.log(`Error while creating dead url channel to RabbitMQ ${error}`);
  }
};

const createdeadLetterChannel = async () => {
  try {
    deadLetterChannel = await connectionToRabbitMQ.createChannel();
    deadLetterChannel = await connectionToRabbitMQ.createChannel();

    await deadLetterChannel.assertQueue(DEAD_LETTER_QUEUE, {
      durable: true,
    });
    consumerForDeadLettersQueue();
  } catch (error) {
    console.log(`Error while creating dead url channel to RabbitMQ ${error}`);
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
    deleteChannel = await connectionToRabbitMQ.createChannel();

    await deleteChannel.assertQueue(DELETE_QUEUE, {
      durable: true,
    });
    await consumerForDeleteQueue();
  } catch (error) {
    console.log(`Error while creating delete channel to RabbitMQ ${error}`);
  }
};

// PUBLISHERS

export const publishToReminderQueue = async (data: Buffer) => {
  try {
    reminderChannel.sendToQueue(REMINDER_QUEUE, data);
  } catch (error) {
    console.log(`Error while publishing to REMINDER_QUEUE queue ${error}`);
  }
};

export const publishToExternalTestQueue = async (data: Buffer) => {
  try {
    externalTestChannel.sendToQueue(EXTERNAL_TEST_QUEUE, data);
  } catch (error) {
    console.log(`Error while publishing to EXTERNAL_TEST_QUEUE queue ${error}`);
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

// CONSUMERS

export const consumerForDeadLettersQueue = () => {
  console.log("----Consumer for Dead_Letter_Queue started----");
  deadLetterChannel.prefetch(1); // process only one message at a time from the queue

  deadLetterChannel.consume(DEAD_LETTER_QUEUE, async (message) => {
    try {
      if (message !== null) {
        const data = message.content;
        let urlId = data.toString();

        if (urlId.includes("delete-cron-")) {
          urlId = urlId.replace("delete-cron-", "").split("-")[1]; // Extract URL ID
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

        // Assign owner to the project (if needed)
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

export const consumerForExternalTestQueue = () => {
  console.log("----Consumer for External_Test_Queue started----");

  externalTestChannel.prefetch(1);
  externalTestChannel.consume(EXTERNAL_TEST_QUEUE, async (message) => {
    try {
      if (message !== null) {
        const data = message.content;
        const key = data.toString(); // Extract the key from the message content ---> structure: external-test-${urlId}-${projectId}")

        console.log(`Processing message from external test queue:`, key);

        const [urlId, projectId] = key.replace("external-test-", "").split("-"); // Extract URL ID.
        const originalKey = `cron-${projectId}-${urlId}`; // Extract the original key from the message content

        const [urlData] = await findUrl({
          query: { _id: urlId },
        });

        if (!urlData) {
          console.log(`URL not found for ID: ${urlId}`);
          externalTestChannel.ack(message);
          return;
        }

        const externalServerTest = await performHealthCheckViaExternalServer({
          body: urlData.body,
          header: urlData.headers,
          method: urlData.method,
          url: urlData.url,
          timeout: urlData.timeout,
          urlId: urlId,
        });

        if (!externalServerTest.isSuccess) {
          console.log(
            `Max retries or timeouts reached for project: ${projectId} and URL ID: ${urlId}`
          );

          const key = `cron-${projectId}-${urlId}`;
          const currentHealthData = await redisClient.hGet(
            key,
            "latestResponse"
          );
          const parsedJson = safeJsonParse(currentHealthData, []);

          await createIncident({
            url: urlId,
            reason: `${
              parsedJson?.[parsedJson.length - 1]?.statusCode || "000"
            }: ${
              parsedJson?.[parsedJson.length - 1]?.errorMessage ||
              "Unknown Error"
            }`,
          });

          await redisClient.del(`shadow-${originalKey}`); // Delete the associated shadow key to stop the cron job
          console.log(`Deleted shadow key: shadow-${originalKey}`);
          await redisClient.expire(`delete-${originalKey}`, 1); // Expire the key to remove it from the processing queue and save data to DB
          console.log(`Expired delete key: delete-${originalKey}`);
          await redisClient.set(`reminder-${urlId}`, 1, {
            EX: 3600,
          }); // Set a reminder for 1 hour to check if URL is back up or not
          console.log(`Published to reminder queue with Key: ${urlId}`);

          publishToDeadLetterQueue(Buffer.from(urlId));
          console.log(`Published to Dead_Letter_Queue`);
        } else {
          // If the external server test is successful, set the shadow key to 1 for 1 hour to start the cron job again
          await redisClient.set(`shadow-cron-${urlId}-${projectId}`, 1, {
            EX: 3600,
          });
          console.log(
            `External server test passed for project: ${projectId} and URL ID: ${urlId}`
          );
        }
        externalTestChannel.ack(message);
        console.log(`Acknowledged message from External_Test_Queue`);
      }
    } catch (error) {
      console.log(`Error while consuming from External_Test_Queue ${error}`);
      externalTestChannel.nack(message, false, true);
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

        const originalKey = parsedData
          .replace("delete-", "")
          .replace("cron-", "");
        const [_, urlId] = originalKey.split("-");

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
          console.log(`Key ${originalKey} has already been processed`);
          deleteChannel.ack(message);
          await redisClient.del(lockKey);
          return;
        }

        const { latestResponse, ...dataTobeSaved } = latestData;
        const parsedJson = safeJsonParse(latestResponse, []);

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
            `Max retries or timeouts reached for URL: ${urlId}, not re-adding to the job`
          );
          deleteChannel.ack(message);
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

        deleteChannel.ack(message);
        console.log(`Acknowledged message from delete queue:`, parsedData);
      }
    } catch (error) {
      console.log(`Error while consuming from Delete_Queue: ${error}`);
      if (lockKey) {
        await redisClient.del(lockKey);
      }
      deleteChannel.nack(message, false, true);
    } finally {
      if (lockKey) {
        await redisClient.del(lockKey);
      }
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
            console.log(`Key ${originalKey} has already been processed`);
            jobChannel.ack(message);
            return;
          }

          health["inspection_time"] = TimezoneService.formatUnixTimestamp(
            TimezoneService.getCurrentTimestamp()
          );

          await redisClient.hIncrBy(originalKey, "numberOfCronruns", 1);

          const parsedLatest = JSON.parse(response.latestResponse);
          let mergedResponse = [];

          if (parsedLatest.length < MAX_ARRAY_LENGTH) {
            mergedResponse = [
              ...parsedLatest.map((r) => convertValuesToStrings(r)),
              convertValuesToStrings(health),
            ];
          } else {
            mergedResponse = [
              ...parsedLatest
                .slice(0, -1)
                .map((r) => convertValuesToStrings(r)),
              convertValuesToStrings(health),
            ];
          }

          await redisClient.hSet(
            originalKey,
            "latestResponse",
            JSON.stringify(mergedResponse)
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
              redisClient.set(`external-test-${urlId}-${projectId}`, "1", {
                EX: 120,
              });

              jobChannel.ack(message);
              console.log(`Acknowledged message from Job_Queue`);
              return;
            } else {
              console.log(
                `Not publishing to Dead_Letter_Queue for project: ${projectId} and URL ID: ${urlId} as error difference is less than threshold`
              );
            }
          }

          if (Number(numberOfRetries) > 0) {
            const newCronSchedule = calculateDynamicBackoff(
              mergedResponse,
              cronSchedule
            );

            const shadowKey = `shadow-${originalKey}`;
            await redisClient.set(shadowKey, 1, {
              EX: newCronSchedule,
            });

            await redisClient.hSet(
              originalKey,
              "cronSchedule",
              newCronSchedule
            );

            console.log(
              `Rescheduled job for project: ${projectId} and URL ID: ${urlId} with delay: ${newCronSchedule}`
            );

            jobChannel.ack(message);
            return;
          }

          const shadowKey = `shadow-${originalKey}`;
          await redisClient.set(shadowKey, 1, {
            EX: urlDataToBeProcessed.cronSchedule,
          });

          jobChannel.ack(message);
          console.log(`Successfully processed URL ID: ${urlId}`);
        }
      }
    } catch (error) {
      console.error(`Error processing message: ${error}`);
      jobChannel.nack(message, false, true);
    } finally {
      if (lockKey) {
        await redisClient.del(lockKey);
      }
    }
  });
};

export const consumerForReminderQueue = () => {
  console.log("----Consumer for reminder_queue started----");

  reminderChannel.prefetch(1);
  reminderChannel.consume(REMINDER_QUEUE, async (message) => {
    try {
      if (message !== null) {
        const data = message.content;
        const parsedData = data.toString();

        console.log(`Processing message from reminder queue:`, parsedData);

        const [_, urlId] = parsedData.split("-");

        const urlData = await findUrl({ query: { _id: urlId } });

        if (urlData.length === 0) {
          console.error(`URL not found for ID: ${urlId}`);
          reminderChannel.ack(message);
          return;
        }

        const urlDataToBeProcessed = {
          ...urlData[0],
          method: urlData[0].method || "GET",
        };

        const health = await performUrlHealthCheck(urlDataToBeProcessed);

        if (health.isSuccess) {
          // URL is back up, so remove the reminder and start the cron job again
          await restartJobAfterDeletion({
            url_data: {
              ...urlDataToBeProcessed,
            },
          });
        } else {
          // Set reminder key again for the URL to check again
          await redisClient.set(`reminder-${urlId}`, 1, {
            EX: 3600,
          });
        }

        reminderChannel.ack(message);
        console.log(`Acknowledged message from reminder queue`);
      }
    } catch (error) {
      console.error(`Error processing message from reminder queue: ${error}`);
      reminderChannel.nack(message, false, true);
    }
  });
};

// UTILITY
export const sendMessageToSlack = async (data: any) => {
  try {
    const channelId = process.env.SLACK_CHANNEL_ID;
    const messageText = messageFormatForSlack(data);

    console.log("Sending message to Slack:", messageText);

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
    console.error("Error while sending message on Slack", error);
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
    console.error("Error while sending message on Slack", error);
  }
};

export const messageFormatForSlack = (data: any) => {
  const messagePayload = `🔴 *Alert! URL Monitoring Notification*\n⚠️ *A URL has gone down*\n\nHey <@${
    data.project.owner.slackUserId
  }>,\nThe monitored URL is currently *unreachable*.\n\n🛠️ *Method:* ${data.method.toUpperCase()} \n🔗 *URL:* <${
    data.url
  }>\n🕒 *Time:* ${new Date().toLocaleString()}\n------------------------MESSAGE END-----------------------\n\n`;
  return messagePayload;
};

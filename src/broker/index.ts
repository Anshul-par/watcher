import amqplib from "amqplib";
import { sleep } from "../utility/sleep";
import { WebClient } from "@slack/web-api";

/* ---------- RabbitMQ Connection ---------- */

let connectionToRabbitMQ: amqplib.Connection = null;

let deadLetterChannel: amqplib.Channel = null;
let jobChannel: amqplib.Channel = null;
let DEAD_LETTER_QUEUE = "dead_url_queue"; // create consumer ---> send mess to slack channel
let JOB_QUEUE = "job_queue"; //create consumer ---> console.log the message

let token = process.env.SLACK_TOKEN; // Replace with your actual bot token
let web = new WebClient(token);

let data = {
  _id: "675963ee5c3d4b9565af4b87",
  url: "https://smartchat.zooq.app/",
  urlWithIpPort: "http://103.116.176.223:3186/",
  cronSchedule: 3600,
  timeout: 10,
  method: "GET",
  project: {
    _id: "675962623d0fdfa13094b08a",
    name: "default",
    description: "",
    createdAt: "2024-12-11T09:58:58.387Z",
    updatedAt: "2024-12-11T09:58:58.387Z",
    __v: 0,
    owner: {
      _id: "67612ac79383a6ab97685dbc",
      name: "Srushti",
      slackUserId: "U085T9K849F",
    },
  },
  createdAt: "2024-12-11T10:05:34.084Z",
  updatedAt: "2024-12-11T10:05:34.084Z",
  __v: 0,
  name: "Smartchat Home",
};

export async function start() {
  // await connectToRabbitMQ();
  // await createJobChannel();
  // await publishToDeadLetterQueue(Buffer.from(JSON.stringify(data)));
  // await consumerForDeadLettersQueue();
}

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
  } catch (error) {
    console.log(`Error while creating Location channel to RabbitMQ ${error}`);
  }
};

const createJobChannel = async () => {
  try {
    jobChannel = await connectionToRabbitMQ.createChannel();

    await deadLetterChannel.assertQueue(JOB_QUEUE, {
      durable: true,
    });
  } catch (error) {
    console.log(`Error while creating Location channel to RabbitMQ ${error}`);
  }
};

export const publishToJobLetterQueue = async (data: Buffer) => {
  try {
    deadLetterChannel.sendToQueue(JOB_QUEUE, data);
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

export const consumerForDeadLettersQueue = async () => {
  console.log("Consumer for dead letter queue started");
  try {
    deadLetterChannel.prefetch(1); // process only one message at a time from the queue
    deadLetterChannel.consume(DEAD_LETTER_QUEUE, async (message) => {
      if (message !== null) {
        const data = message.content;
        const parsedData = JSON.parse(data.toString());

        await sendMEssageOnSlack(parsedData);

        deadLetterChannel.ack(message);

        console.log(`Received message from dead letter queue:`, parsedData);
      }
    });
  } catch (error) {
    console.log(`Error while consuming from Location queue ${error}`);
  }
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

export const sendMEssageOnSlack = async (data: any) => {
  try {
    // Define the channel ID or name and the message
    const channelId = "C0857NJJCG6";
    const messageText = await dataFormateForSlack(data);

    const result = await web.chat.postMessage({
      channel: channelId,
      text: messageText,
    });

    if (result.ok) {
      console.log("Message sent successfully");
    } else {
      console.log("Error while sending message to slack");
    }
  } catch (error) {
    console.error(error);
  }
};

async function dataFormateForSlack(data: any) {
  let messagePayload = `🔴 *Alert! URL Monitoring Notification*\n⚠️ *A URL has gone down*\n\nHey <@${
    data.project.owner.slackUserId
  }>,\nThe monitored URL is currently *unreachable*.\n\n🛠️ *Method:*  ${data.method.toUpperCase()} \n🔗 *URL:* <${
    data.url
  }>\n🕒 *Time:* ${new Date().toLocaleString()}\n------------------------MESSAGE END-----------------------\n\n`;
  return messagePayload;
}

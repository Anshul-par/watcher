import amqplib from "amqplib";
import { sleep } from "../utility/sleep";

/* ---------- RabbitMQ Connection ---------- */

let connectionToRabbitMQ: amqplib.Connection = null;

let deadLetterChannel: amqplib.Channel = null;
let jobChannel: amqplib.Channel = null;
let DEAD_LETTER_QUEUE = "dead_url_queue";
let JOB_QUEUE = "job_queue";

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
    deadLetterChannel.consume(DEAD_LETTER_QUEUE, async (message) => {
      if (message !== null) {
        const data = message.content;
        const parsedData = JSON.parse(data.toString());

        console.log(`Received message from dead letter queue: ${parsedData}`);
      }
    });
  } catch (error) {
    console.log(`Error while consuming from Location queue ${error}`);
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

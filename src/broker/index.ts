import amqplib from "amqplib"
import { sleep } from "../utility/sleep"
import { WebClient } from "@slack/web-api"
import { redisClient } from "../utility/startServer"
import {
  decreasingBackoff,
  MOST_ERROR_COUNT,
  MOST_TIMEOUT_COUNT,
} from "../constants"
import { convertValuesToStrings } from "../utility/convertValuesToString"
import { performUrlHealthCheck } from "../utility/performHealthCheck"
import { findUrl } from "../services/url.service"
import { URLModel } from "../models/url.model"
import { UserModel } from "../models/user.model"
import { TimezoneService } from "../services/timezone.service"
import { createHealth } from "../services/health.service"
import { addJobService } from "../services/jobs.service"
import { acquireLock } from "../utility/acquireLock"

let connectionToRabbitMQ: amqplib.Connection = null

let deadLetterChannel: amqplib.Channel = null
let deleteChannel: amqplib.Channel = null
let jobChannel: amqplib.Channel = null

let DEAD_LETTER_QUEUE = "dead_url_queue"
let DELETE_QUEUE = "delete_url_queue"
let JOB_QUEUE = "job_url_queue"

const web = new WebClient(process.env.SLACK_TOKEN)

export const connectToRabbitMQ = async () => {
  let retries = 0
  const MAX_RETRIES = 5
  const RETRY_DELAY = 2000

  while (retries < MAX_RETRIES) {
    try {
      // amqp://<username>:<password>@<host>:<port>
      connectionToRabbitMQ = await amqplib.connect(process.env.RABBITMQ_URL)
      console.log("--RabbitMQ Connected--")
      await createdeadLetterChannel()
      await createJobChannel()
      await createDeleteChannel()
      break
    } catch (error) {
      console.log(`Error while connecting to RabbitMQ: ${error}`)
      retries++
      sleep(RETRY_DELAY * retries)
      if (retries < MAX_RETRIES) {
        console.log(`Retrying connection (${retries}/${MAX_RETRIES})...`)
        await sleep(RETRY_DELAY * retries)
      } else {
        console.log("Max retries reached. Could not connect to RabbitMQ.")
        throw error
      }
    }
  }
}

const createdeadLetterChannel = async () => {
  try {
    deadLetterChannel = await connectionToRabbitMQ.createChannel()

    await deadLetterChannel.assertQueue(DEAD_LETTER_QUEUE, {
      durable: true,
    })
    consumerForDeadLettersQueue()
  } catch (error) {
    console.log(`Error while creating Location channel to RabbitMQ ${error}`)
  }
}

const createJobChannel = async () => {
  try {
    jobChannel = await connectionToRabbitMQ.createChannel()

    await jobChannel.assertQueue(JOB_QUEUE, {
      durable: true,
    })
    await consumerForJobQueue()
  } catch (error) {
    console.log(`Error while creating Location channel to RabbitMQ ${error}`)
  }
}

const createDeleteChannel = async () => {
  try {
    deleteChannel = await connectionToRabbitMQ.createChannel()

    await deleteChannel.assertQueue(DELETE_QUEUE, {
      durable: true,
    })
    await consumerForDeleteQueue()
  } catch (error) {
    console.log(`Error while creating Location channel to RabbitMQ ${error}`)
  }
}

export const publishToJobLetterQueue = async (data: Buffer) => {
  try {
    jobChannel.sendToQueue(JOB_QUEUE, data)
  } catch (error) {
    console.log(`Error while publishing to Location queue ${error}`)
  }
}

export const publishToDeadLetterQueue = async (data: Buffer) => {
  try {
    deadLetterChannel.sendToQueue(DEAD_LETTER_QUEUE, data)
  } catch (error) {
    console.log(`Error while publishing to Location queue ${error}`)
  }
}

export const publishToDeleteQueue = async (data: Buffer) => {
  try {
    deleteChannel.sendToQueue(DELETE_QUEUE, data)
  } catch (error) {
    console.log(`Error while publishing to Location queue ${error}`)
  }
}

export const consumerForDeadLettersQueue = () => {
  console.log("----Consumer for Dead_Letter_Queue started----")
  deadLetterChannel.prefetch(1) // process only one message at a time from the queue
  deadLetterChannel.consume(DEAD_LETTER_QUEUE, async (message) => {
    try {
      if (message !== null) {
        const data = message.content
        let urlId = data.toString()

        if (urlId.includes("delete-cron-")) {
          urlId = urlId.replace("delete-cron-", "").split("-")[1] // Extract URL ID.
        }

        console.log(`Processing message from dead letter queue:`, urlId)

        const urlDetails = await URLModel.findById(urlId).populate({
          path: "project",
        })

        //@ts-ignore
        const owner = await UserModel.findById(urlDetails.project.owner)

        //@ts-ignore
        urlDetails.project.owner = owner

        await sendMessageToSlack(urlDetails)

        deadLetterChannel.ack(message)

        console.log(`Received message from dead letter queue`)
      }
    } catch (error) {
      console.log(`Error while consuming from Dead_Letter_Queue ${error}`)
    }
  })
}

export const consumerForDeleteQueue = () => {
  console.log("----Consumer for Delete_Queue started----")

  deleteChannel.prefetch(1)
  deleteChannel.consume(DELETE_QUEUE, async (message) => {
    let lockKey = null
    try {
      if (message !== null) {
        const data = message.content
        const parsedData = data.toString()
        console.log(`Processing message from delete queue:`, parsedData)

        const originalKey = parsedData.replace("delete-", "")
        const [_, urlId] = originalKey.replace("cron-", "").split("-")

        // Step 1: Try to acquire the lock
        lockKey = `lock:${urlId}`
        const lockAcquired = await acquireLock({ lockKey })

        if (!lockAcquired) {
          console.log(
            `Failed to acquire lock for URL ID: ${urlId} after retries. Requeueing message.`
          )
          deleteChannel.nack(message, false, true)
          return
        }

        console.log(`Successfully acquired lock for URL ID: ${urlId}`)

        // Step 2: Delete shadow key
        const shadowKey = `shadow-${originalKey}`
        await redisClient.del(shadowKey)

        // Step 3: Fetch and validate data
        const latestData = await redisClient.hGetAll(`${originalKey}`)

        if (
          !latestData ||
          !Object.keys(JSON.parse(JSON.stringify(latestData))).length
        ) {
          console.log(`key ${originalKey} has been already processed`)
          deleteChannel.ack(message)
          await redisClient.del(lockKey)
          return
        }

        // Step 4: Process the latest response data
        const { latestResponse, ...dataTobeSaved } = latestData
        let parsedJson
        try {
          parsedJson = JSON.parse(latestResponse)
        } catch (error) {
          parsedJson = []
        }

        // Step 5: Save to database
        // @ts-ignore
        await createHealth({
          ...dataTobeSaved,
          unix: TimezoneService.getCurrentTimestamp(),
          latestResponse: parsedJson,
          url: urlId,
        })

        console.log(`Saved data for URL: ${urlId}`)

        // Step 6: Check retry ability
        const numberOfTimeouts = await redisClient.hGet(
          originalKey,
          "numberOfTimeouts"
        )
        const numberOfRetries = await redisClient.hGet(
          originalKey,
          "numberOfRetries"
        )

        const isRetryAble = !(
          Number(numberOfTimeouts) >= MOST_TIMEOUT_COUNT ||
          Number(numberOfRetries) >= MOST_ERROR_COUNT
        )

        // Step 7: Delete the original key
        await redisClient.del(`${originalKey}`)
        console.log(`Deleted key: ${originalKey}`)

        if (!isRetryAble) {
          console.log(
            `Max retries or timeouts reached for URL: ${urlId} thats why not re-adding to the job`
          )
          deleteChannel.ack(message)
          await redisClient.del(lockKey)
          return
        }

        // Step 8: Find URL data and re-add job if retryable
        const url_data = await findUrl({
          query: { _id: urlId },
        })

        if (url_data && url_data.length > 0) {
          // @ts-ignore
          await addJobService({ url_data: url_data[0] })
        }

        // Step 9: Release lock and acknowledge message
        await redisClient.del(lockKey)
        deleteChannel.ack(message)
        console.log(`acknowledged message from delete queue:`, parsedData)
      }
    } catch (error) {
      console.log(`Error while consuming from Delete_Queue  ${error}`)
      // Release lock if there was an error
      if (lockKey) {
        await redisClient.del(lockKey)
      }
      // Requeue the message
      deleteChannel.nack(message, false, true)
    }
  })
}

export const consumerForJobQueue = () => {
  console.log("----Consumer for Job_Queue started----")

  jobChannel.prefetch(1)
  jobChannel.consume(JOB_QUEUE, async (message) => {
    let lockKey = null
    try {
      if (message !== null) {
        const data = message.content
        const parsedData = data.toString()
        const originalKey = parsedData.replace("shadow-", "")

        if (originalKey.includes("cron")) {
          const [projectId, urlId] = originalKey.replace("cron-", "").split("-")

          lockKey = `lock:${urlId}`
          const lockAcquired = await acquireLock({ lockKey })

          if (!lockAcquired) {
            console.log(
              `Failed to acquire lock for URL ID: ${urlId} after retries. Requeueing message.`
            )
            jobChannel.nack(message, false, true)
            return
          }

          console.log(`Successfully acquired lock for URL ID: ${urlId}`)

          // Step 2: Process the message
          const urlData = await findUrl({ query: { _id: urlId } })

          if (urlData.length === 0) {
            console.error(`URL not found for ID: ${urlId}`)
            jobChannel.ack(message)
            await redisClient.del(lockKey)
            return
          }

          // Step 3: Perform health check
          const urlDataToBeProcessed = {
            ...urlData[0],
            method: urlData[0].method || "GET",
          }

          const health = await performUrlHealthCheck(urlDataToBeProcessed)

          console.log(health, "ansh")

          // Step 4: Update Redis with results
          const response = await redisClient.hGetAll(originalKey)

          if (
            !response ||
            !Object.keys(JSON.parse(JSON.stringify(response))).length
          ) {
            console.log(`Key ${originalKey} has been already processed`)
            jobChannel.ack(message)
            await redisClient.del(lockKey)
            return
          }

          // Update health check results
          await redisClient.hSet(
            originalKey,
            "latestResponse",
            JSON.stringify([...JSON.parse(response.latestResponse), health])
          )

          // Step 5: Schedule next check
          const shadowKey = `shadow-${originalKey}`
          await redisClient.set(shadowKey, 1, {
            EX: urlDataToBeProcessed.cronSchedule,
          })

          // Step 6: Release the lock and acknowledge
          await redisClient.del(lockKey)
          jobChannel.ack(message)
          console.log(`Successfully processed URL ID: ${urlId}`)
        }
      }
    } catch (error) {
      console.error(`Error processing message: ${error}`)
      if (lockKey) {
        await redisClient.del(lockKey)
      }
      jobChannel.nack(message, false, true)
    }
  })
}

export const deleteQueue = async (queueName: string) => {
  try {
    await deadLetterChannel.deleteQueue(queueName)
  } catch (error) {
    console.log(`Error while deleting queue ${error}`)
  }
}

export const closeRabbitMQConnection = async () => {
  try {
    await deadLetterChannel.close()
    await connectionToRabbitMQ.close()
    console.log("--RabbitMQ Connection Closed--")
  } catch (error) {
    console.log(`Error while closing RabbitMQ connection ${error}`)
  }
}

export const sendMessageToSlack = async (data: any) => {
  try {
    const channelId = process.env.SLACK_CHANNEL_ID
    const messageText = messageFormatForSlack(data)

    const result = await web.chat.postMessage({
      channel: channelId,
      text: messageText,
    })

    if (result.ok) {
      console.log("Message SENT on Slack")
    } else {
      console.log("Message NOT_SENT to Slack")
    }
  } catch (error) {
    console.error("Error while sending message on slack", error)
  }
}

export const messageFormatForSlack = (data: any) => {
  let messagePayload = `🔴 *Alert! URL Monitoring Notification*\n⚠️ *A URL has gone down*\n\nHey <@${
    data.project.owner.slackUserId
  }>,\nThe monitored URL is currently *unreachable*.\n\n🛠️ *Method:*  ${data.method.toUpperCase()} \n🔗 *URL:* <${
    data.url
  }>\n🕒 *Time:* ${new Date().toLocaleString()}\n------------------------MESSAGE END-----------------------\n\n`
  return messagePayload
}

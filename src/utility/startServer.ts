import { Application } from "express"
import { connectToDB } from "./connectToDB"
import { createRedisClient } from "./createRedisClient"
import { RedisClientType } from "redis"
import { connectToRabbitMQ } from "../broker"

export let redisClient: RedisClientType
export let redisClientDuplicate: RedisClientType

export const startServer = async (app: Application, port: number) => {
  try {
    await connectToDB()

    const { r, r_d } = await createRedisClient()
    redisClient = r
    redisClientDuplicate = r_d

    await connectToRabbitMQ()

    app.listen(port, () => {
      console.log(`server started at port: ${port}\n`)
    })
  } catch (error) {
    console.log(error)
  }
}

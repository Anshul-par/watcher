import { Application } from "express";
import { connectToDB } from "./connectToDB";
import { createRedisClient } from "./createRedisClient";
import { RedisClientType } from "redis";
import { connectToRabbitMQ } from "../broker";
import { findUrl } from "../services/url.service";
import { addJobService } from "../services/jobs.service";

export let redisClient: RedisClientType;
export let redisClientDuplicate: RedisClientType;

export const startServer = async (app: Application, port: number) => {
  try {
    await connectToDB();
    await connectToRabbitMQ();

    const { r, r_d } = await createRedisClient();
    redisClient = r;
    redisClientDuplicate = r_d;

    const url = await findUrl({
      query: {},
    });

    await addJobService({ url_data: url });

    app.listen(port, () => {
      console.log(`server started at port: ${port}\n`);
    });
  } catch (error) {
    console.log(error);
  }
};

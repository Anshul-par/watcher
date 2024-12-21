import { createClient, RedisClientType } from "redis";
import { sleep } from "./sleep";

export const createRedisClient = async () => {
  let retries = 0;
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 2000;

  while (retries < MAX_RETRIES) {
    try {
      const client_1 = createClient({
        url: process.env.REDIS_URL,
        // password: process.env.REDIS_PASSWORD,
      }) as RedisClientType;
      const client_2 = createClient({
        url: process.env.REDIS_URL,
        // password: process.env.REDIS_PASSWORD,
      }) as RedisClientType;

      // If Pub-sub is used, any place in the code-base, r -> publisher and r_d -> subscriber
      const r = await client_1.connect();
      const r_d = await client_2.connect();

      // listen for expired keys
      r.configSet("notify-keyspace-events", "Ex");

      console.log("--Redis Connected--");

      // listen
      return { r, r_d };
    } catch (error) {
      console.log(`Error while creating Redis client: ${error}`);
      retries++;
      if (retries < MAX_RETRIES) {
        console.log(`Retrying connection (${retries}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * retries);
      } else {
        console.log("Max retries reached. Could not connect to Redis.");
        throw error;
      }
    }
  }
};

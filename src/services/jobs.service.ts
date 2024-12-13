import { StatusCodes } from "http-status-codes";
import { APIError } from "../errors/apiError";
import { IURL } from "../types/model.types";
import { convertValuesToStrings } from "../utility/convertValuesToString";
import { redisClient } from "../utility/startServer";

export const addJobService = async ({ url_data }: { url_data: IURL }) => {
  try {
    const key = `cron-${url_data.project}-${url_data._id}`;
    const shadowKey = `shadow-${key}`;
    const otherParams = {
      numberOfRetries: 0,
      latestResponse: "",
      // other params can be added if needed
    };
    await redisClient.hSet(
      key,
      convertValuesToStrings({ ...url_data, ...otherParams })
    );
    await redisClient.set(shadowKey, "1", {
      EX: url_data.cronSchedule,
    });
  } catch (error) {
    console.log("Error while adding job", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

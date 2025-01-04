import { StatusCodes } from "http-status-codes";
import { APIError } from "../errors/apiError";
import { IURL } from "../types/model.types";
import { convertValuesToStrings } from "../utility/convertValuesToString";
import { redisClient } from "../utility/startServer";
import { TimezoneService } from "./timezone.service";

export const addJobService = async ({ url_data }: { url_data: IURL }) => {
  if (!url_data.project || !url_data._id) {
    throw new APIError(
      StatusCodes.BAD_REQUEST,
      "Project and _id are required to add a job"
    );
  }

  try {
    const key = `cron-${url_data.project}-${url_data._id}`;
    const shadowKey = `shadow-${key}`;
    const deleteKey = `delete-${key}`;
    const otherParams = {
      numberOfRetries: 0,
      numberOfTimeouts: 0,
      numberOfCronruns: 0,
      latestResponse: JSON.stringify([]),
      // other params can be added if needed
    };

    // Remove unwanted fields
    delete url_data.createdAt;
    delete url_data.updatedAt;

    const mainKeyExists = await redisClient.exists(key);

    if (!mainKeyExists) {
      await redisClient.hSet(
        key,
        convertValuesToStrings({ ...url_data, ...otherParams })
      );
    }

    const secondsRemainingToday = TimezoneService.getSecondsRemainingToday();
    const expiration = Math.max(1, secondsRemainingToday - 3600);

    const shadowKeyExists = await redisClient.exists(shadowKey);
    const deleteKeyExists = await redisClient.exists(deleteKey);

    if (!shadowKeyExists) {
      await redisClient.set(shadowKey, "1", {
        EX: url_data.cronSchedule,
      });
    }

    if (!deleteKeyExists) {
      await redisClient.set(deleteKey, "1", { EX: expiration });
    }
  } catch (error) {
    console.log("Error while adding job", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

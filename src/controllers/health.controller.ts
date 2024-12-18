import { StatusCodes } from "http-status-codes";
import {
  createHealth,
  deleteHealth,
  findHealth,
  updateHealth,
} from "../services/health.service";
import { IHealth } from "../types/model.types";
import { Request } from "../types/request.types";
import { Response } from "express";
import { findUrl } from "../services/url.service";
import { redisClient } from "../utility/startServer";

export const createHealthController = async (req: Request, res: Response) => {
  const payload: IHealth = req.body;

  await createHealth(payload);

  res
    .status(StatusCodes.CREATED)
    .json({ message: "URL created successfully", success: true });
};

export const getLiveHealthController = async (req: Request, res: Response) => {
  const { url } = req.query;

  const url_data = await findUrl({ query: { _id: url } });

  if (url_data.length === 0) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "URL not found", success: false });
  }

  const urlInfo = url_data[0];
  const key = `cron-${urlInfo.project}-${urlInfo._id}`;

  const healthCheck = await redisClient.hGetAll(key);

  if (!healthCheck) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Health check not found", success: false });
  }

  return res.status(StatusCodes.OK).json({
    message: "Health check fetched successfully",
    success: true,
    data: {
      ...healthCheck,
      latestResponse: JSON.parse(healthCheck.latestResponse || "[]"),
    },
  });
};

export const getHealthController = async (req: Request, res: Response) => {
  const q: Partial<IHealth> = req.query;
  const query: any = { ...q };

  if (q.createdAt) {
    const selectedDate = new Date(q.createdAt.toString());

    // Start of the day
    const startOfDay = new Date(selectedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    // End of the day
    const endOfDay = new Date(selectedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    query.createdAt = { $gte: startOfDay, $lte: endOfDay };
  }

  const data = await findHealth({
    query,
  });

  return res
    .status(StatusCodes.OK)
    .json({ message: "URL fetched successfully", success: true, data });
};

export const updateHealthController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload: Partial<IHealth> = req.body;

  await updateHealth({ query: { _id: id }, update: payload });

  res
    .status(StatusCodes.OK)
    .json({ message: "URL updated successfully", success: true });
};

export const deleteHealthController = async (req: Request, res: Response) => {
  const { id } = req.params;

  await deleteHealth({ query: { _id: id } });

  res
    .status(StatusCodes.OK)
    .json({ message: "URL deleted successfully", success: true });
};

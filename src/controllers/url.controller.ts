import { StatusCodes } from "http-status-codes";
import {
  createUrl,
  deleteUrl,
  findUrl,
  updateUrl,
} from "../services/url.service";
import { IURL } from "../types/model.types";
import { Request } from "../types/request.types";
import { Response } from "express";
import { addJobService } from "../services/jobs.service";

export const createUrlController = async (req: Request, res: Response) => {
  const payload: IURL = req.body;

  const url = await createUrl(payload);

  await addJobService({
    // @ts-ignore
    url_data: {
      ...url,
    },
  });

  res
    .status(StatusCodes.CREATED)
    .json({ message: "URL created successfully", success: true });
};

export const getUrlController = async (req: Request, res: Response) => {
  const q: Partial<IURL> = req.query;

  const data = await findUrl({
    query: q,
    populate: ["project"],
  });

  return res
    .status(StatusCodes.OK)
    .json({ message: "URL fetched successfully", success: true, data });
};

export const updateUrlController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload: Partial<IURL> = req.body;

  await updateUrl({ query: { _id: id }, update: payload });

  res
    .status(StatusCodes.OK)
    .json({ message: "URL updated successfully", success: true });
};

export const deleteUrlController = async (req: Request, res: Response) => {
  const { id } = req.params;

  await deleteUrl({ query: { _id: id } });

  res
    .status(StatusCodes.OK)
    .json({ message: "URL deleted successfully", success: true });
};

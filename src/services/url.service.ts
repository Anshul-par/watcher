import { FilterQuery, ClientSession } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { URLModel } from "../models/url.model";
import { APIError } from "../errors/apiError";
import { IURL } from "../types/model.types";

export const findUrl = async ({
  query,
  populate = [],
}: {
  query: FilterQuery<IURL>;
  populate?: string[];
  session?: ClientSession;
}) => {
  try {
    const url = await URLModel.find(query, {}).populate(populate).lean();
    return url;
  } catch (error: any) {
    console.log("Error while finding URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

type UpdateOperators<T> = {
  $set?: Partial<T>;
  $inc?: Partial<Record<keyof T, number>>;
  $push?: Partial<Record<keyof T, any>>;
  $pull?: Partial<Record<keyof T, any>>;
  $unset?: Partial<Record<keyof T, any>>;
};

export const updateUrl = async ({
  query,
  update,
}: {
  query: FilterQuery<IURL>;
  update: Partial<IURL> & UpdateOperators<IURL>;
}) => {
  try {
    const url = await URLModel.findOneAndUpdate(query, update, {
      new: true,
    }).lean();

    return url;
  } catch (error: any) {
    console.log("Error while updating URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

export const createUrl = async (urlData: IURL) => {
  try {
    const url = await URLModel.create(urlData);
    return url.toObject();
  } catch (error: any) {
    console.log("Error while creating URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

export const deleteUrl = async ({ query }: { query: FilterQuery<IURL> }) => {
  try {
    const result = await URLModel.findOneAndDelete(query).lean();
    return result;
  } catch (error: any) {
    console.log("Error while deleting URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

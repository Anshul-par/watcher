import { FilterQuery, ClientSession } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { IncidentModel } from "../models/incident.model";
import { APIError } from "../errors/apiError";
import { IIncident } from "../types/model.types";

export const findIncident = async ({
  query,
  populate = [],
}: {
  query: FilterQuery<IIncident>;
  populate?: string[];
  session?: ClientSession;
}) => {
  try {
    const i = await IncidentModel.find(query, {}).populate(populate).lean();
    return i;
  } catch (error: any) {
    console.log("Error while finding Incident", error);
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

export const updateIncident = async ({
  query,
  update,
}: {
  query: FilterQuery<IIncident>;
  update: Partial<IIncident> & UpdateOperators<IIncident>;
}) => {
  try {
    const i = await IncidentModel.findOneAndUpdate(query, update, {
      new: true,
    }).lean();

    return i;
  } catch (error: any) {
    console.log("Error while updating URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

export const createIncident = async (urlData: IIncident) => {
  try {
    const i = await IncidentModel.create(urlData);
    return i.toObject();
  } catch (error: any) {
    console.log("Error while creating URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

export const deleteIncident = async ({
  query,
}: {
  query: FilterQuery<IIncident>;
}) => {
  try {
    const i = await IncidentModel.findOneAndDelete(query).lean();
    return i;
  } catch (error: any) {
    console.log("Error while deleting URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

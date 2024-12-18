import { FilterQuery, ClientSession } from "mongoose";
import { HealthModel } from "../models/health.model";
import { APIError } from "../errors/apiError";
import { StatusCodes } from "http-status-codes";
import { IHealth } from "../types/model.types";

// Create a new health entry
export const createHealth = async (healthData: IHealth) => {
  try {
    const health = await HealthModel.create(healthData);
    return health.toObject();
  } catch (error: any) {
    console.log("Error while creating health entry", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

// Find a health entry based on a query, with optional population of references
export const findHealth = async ({
  query,
  populate = [],
  session = null,
}: {
  query: FilterQuery<IHealth>;
  populate?: string[];
  session?: ClientSession;
}) => {
  try {
    const health = await HealthModel.find(query)
      .populate(populate)
      .session(session)
      .lean();
    return health;
  } catch (error: any) {
    console.log("Error while finding health entry", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

// Update a health entry
export const updateHealth = async ({
  query,
  update,
}: {
  query: FilterQuery<IHealth>;
  update: Partial<IHealth>;
}) => {
  try {
    const updatedHealth = await HealthModel.findOneAndUpdate(query, update, {
      new: true,
    }).lean();
    return updatedHealth;
  } catch (error: any) {
    console.log("Error while updating health entry", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

// Delete a health entry
export const deleteHealth = async (query: FilterQuery<IHealth>) => {
  try {
    const deletedHealth = await HealthModel.findOneAndDelete(query);
    return deletedHealth;
  } catch (error: any) {
    console.log("Error while deleting health entry", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

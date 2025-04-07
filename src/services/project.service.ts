import { FilterQuery, ClientSession } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { ProjectModel } from "../models/project.model";
import { APIError } from "../errors/apiError";
import { IProject } from "../types/model.types";

export const findProject = async ({
  query,
  populate = [],
}: {
  query: FilterQuery<IProject>;
  populate?: string[];
  session?: ClientSession;
}) => {
  try {
    const url = await ProjectModel.find(query, {}).populate(populate).lean();
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

export const updateProject = async ({
  query,
  update,
}: {
  query: FilterQuery<IProject>;
  update: Partial<IProject> & UpdateOperators<IProject>;
}) => {
  try {
    const url = await ProjectModel.findOneAndUpdate(query, update, {
      new: true,
    }).lean();

    return url;
  } catch (error: any) {
    console.log("Error while updating URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

export const createProject = async (urlData: IProject) => {
  try {
    const url = await ProjectModel.create(urlData);
    return url.toObject();
  } catch (error: any) {
    console.log("Error while creating URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

export const deleteProject = async ({
  query,
}: {
  query: FilterQuery<IProject>;
}) => {
  try {
    const result = await ProjectModel.findOneAndDelete(query).lean();
    return result;
  } catch (error: any) {
    console.log("Error while deleting URL", error);
    throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
};

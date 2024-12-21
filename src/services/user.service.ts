import { FilterQuery } from "mongoose";
import { UserModel } from "../models/user.model";
import { IUser } from "../types/model.types";
import { APIError } from "../errors/apiError";
import { StatusCodes } from "http-status-codes";

export const getUser = async ({
  query,
  populate = [],
}: {
  query: FilterQuery<IUser>;
  populate?: string[];
}) => {
  try {
    const u = await UserModel.find(query).populate(populate).lean();
    return u;
  } catch (error) {
    console.log("Error while fetching user: ", error);
    throw new APIError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Error while fetching user"
    );
  }
};

export const deleteUser = async ({ query }: { query: FilterQuery<IUser> }) => {
  try {
    const u = await UserModel.findOneAndDelete(query).lean();
    return u;
  } catch (error) {
    console.log("Error while deleting user: ", error);
    throw new APIError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Error while deleting user"
    );
  }
};

export const createUser = async (user: IUser) => {
  try {
    const u = await UserModel.create(user);
    return u.toObject();
  } catch (error) {
    console.log("Error while creating user: ", error);
    throw new APIError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Error while creating user"
    );
  }
};

export const updateUser = async ({
  query,
  updates,
}: {
  query: FilterQuery<IUser>;
  updates: Partial<IUser>;
}) => {
  try {
    const u = await UserModel.findOneAndUpdate(query, updates, {
      new: true,
    }).lean();
    return u;
  } catch (error) {
    console.log("Error while updating user: ", error);
    throw new APIError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Error while updating user"
    );
  }
};

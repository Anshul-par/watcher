import { FilterQuery } from "mongoose";
import { UserModel } from "../models/user.model";

export const deleteUser = async (_id: string) => {
  await UserModel.findByIdAndDelete(_id);
};

export const getAllUser = async () => {
  const user = await UserModel.find().select(
    "firstName lastName email isAppleLogin isGoogleLogin isFacebookLogin isGuestLogin brush deviceId createdAt updatedAt"
  );
  // return user ? user.map((item) => new User(item)) : null;
  return user ? user.map((item) => new UserModel(item)) : null;
};

export const getPopulatedUserById = async (_id: string) => {
  const user = await UserModel.findById(_id).select("-password").lean();

  return user;
};

export const getUserById = async (_id: string) => {
  const user = await UserModel.findById(_id).lean();
  return user ? new UserModel(user) : null;
};

export const getUserByFirstName = async (name: string) => {
  const user = await UserModel.findOne({ name }).lean();
  return user;
};

export const saveUser = async (user: any) => {
  await UserModel.create(user);

  return;
};

export const updateUser = async ({
  query,
  updates,
}: {
  query: FilterQuery<any>;
  updates: Partial<any>;
}) => {
  let user = await UserModel.findOneAndUpdate(query, updates, {
    new: true,
  }).lean();
  return user;
};

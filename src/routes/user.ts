import express from "express";
import { UserModel } from "../models/user.model";
import { StatusCodes } from "http-status-codes";

const userRouter = express.Router();

userRouter.get("/", async (_, res) => {
  try {
    const users = await UserModel.find({});
    res.status(StatusCodes.OK).json({
      message: "Users fetched successfully",
      success: true,
      data: users,
    });
  } catch (error) {
    console.log("Error in userRouter.get(/): ", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Internal Server Error", success: false });
  }
});

export { userRouter };

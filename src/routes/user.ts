import express from "express";
import { UserModel } from "../models/user.model";
import { StatusCodes } from "http-status-codes";
import { validateReqSchema } from "../middlewares/validateReqSchema";
import {
  validate_create_user,
  validate_update_user,
} from "../validators/user.validators";
import { valiadte_param_id } from "../validators/custom";
import { hashPassword } from "../utility/hashPassword";

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

userRouter.post(
  "/",
  validateReqSchema(validate_create_user),
  async (req, res) => {
    const payload = req.body;
    try {
      const users = await UserModel.create(payload);
      res.status(StatusCodes.OK).json({
        message: "User created successfully",
        success: true,
        data: users,
      });
    } catch (error) {
      console.log("Error in userRouter.get(/): ", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal Server Error", success: false });
    }
  }
);

userRouter.patch(
  "/:id",
  validateReqSchema(validate_update_user),
  async (req, res) => {
    const payload = req.body;
    const { id } = req.params;
    try {
      if (payload.password) {
        payload.password = hashPassword(payload.password);
      }

      const user = await UserModel.findByIdAndUpdate(id, payload).lean();
      res.status(StatusCodes.OK).json({
        message: "Users updated successfully",
        success: true,
        data: user,
      });
    } catch (error) {
      console.log("Error in userRouter.get(/): ", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal Server Error", success: false });
    }
  }
);

userRouter.delete(
  "/:id",
  validateReqSchema(valiadte_param_id),
  async (req, res) => {
    const { id } = req.params;
    try {
      const users = await UserModel.findByIdAndDelete(id);
      res.status(StatusCodes.OK).json({
        message: "Users deleted successfully",
        success: true,
        data: users,
      });
    } catch (error) {
      console.log("Error in userRouter.get(/): ", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal Server Error", success: false });
    }
  }
);

export { userRouter };

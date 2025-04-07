import { StatusCodes } from "http-status-codes";
import { Response } from "express";
import { APIError } from "../errors/apiError";

export const errorMiddleware = (
  err: Error | APIError,
  _,
  res: Response,
  __
) => {
  console.log(err);

  if (err instanceof APIError) {
    return res
      .status(err.statusCode)
      .json({ message: err.message, success: false });
  }

  res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ internalError: true, message: err.message });
};

import { Request, NextFunction, Response } from "express";
import { StatusCodes } from "http-status-codes";

export const validateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  //@ts-ignore
  if (!req.admin) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Unauthorized requests." })
      .end();
    return;
  }
  next();
};

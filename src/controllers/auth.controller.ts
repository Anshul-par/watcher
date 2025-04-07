import { Response, Request } from "express";
import { createUser, getUser } from "../services/user.service";
import { generateJWT } from "../utility/genJWT";
import { StatusCodes } from "http-status-codes";
import { comparePassword, hashPassword } from "../utility/hashPassword";
import { APIError } from "../errors/apiError";

export const registerController = async (req: Request, res: Response) => {
  const payloadValue = req.body;

  const hashedPassword = hashPassword(payloadValue.password);
  payloadValue.password = hashedPassword;

  const user = await createUser(payloadValue);

  return res.status(StatusCodes.OK).json({
    message: "User register successfully",
    success: true,
  });
};

export const loginController = async (req: Request, res: Response) => {
  const payloadValue = req.body;

  const user = await getUser({ query: { name: payloadValue.name } });

  if (!user.length) {
    throw new APIError(StatusCodes.NOT_FOUND, "User not found");
  }

  const isValid = comparePassword(payloadValue.password, user[0].password);
  if (!isValid) {
    throw new APIError(StatusCodes.UNAUTHORIZED, "Invalid password");
  }

  const token = generateJWT({ id: user[0]._id });

  delete user[0].password;

  return res.status(StatusCodes.OK).json({
    message: "User login successfully",
    success: true,
    user: user[0],
    token,
  });
};

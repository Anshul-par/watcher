import { NextFunction } from "express";
import { APIError } from "../errors/apiError";
import { StatusCodes } from "http-status-codes";
import { verifyJWT } from "../utility/genJWT";
import { Request } from "../types/request.types";
import { getUser } from "../services/user.service";

export const validateJWT = async (req: Request, _, next: NextFunction) => {
  const token = req.header("Authorization");

  if (!token) {
    throw new APIError(
      StatusCodes.UNAUTHORIZED,
      "Token Not Found. Unauthorized Request. Login Again"
    );
  }

  let decode: any;
  try {
    decode = verifyJWT(token);
  } catch (error) {
    console.log("Error in verifying token", error);
    throw new APIError(
      StatusCodes.UNAUTHORIZED,
      "Token is Expired. Login Again"
    );
  }

  const user = await getUser({ query: { _id: decode.id } });

  if (!user) {
    throw new APIError(StatusCodes.UNAUTHORIZED, "Unauthorized Request.");
  }

  // ATTACH USER OBJECT IN REQ OBJECT FOR FURTHER USE IN CONTROLLERS
  // @ts-ignore
  req.authUser = user[0];

  // ATTACH ADMIN FLAG IN REQ OBJECT FOR FURTHER USE IN CONTROLLERS
  req.admin = user[0].role === "ADMIN";

  next();
};

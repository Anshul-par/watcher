import Joi, { Schema, ValidationResult } from "joi";
import { NextFunction, Response, Request } from "express";
import { StatusCodes } from "http-status-codes";
import { pick } from "../utility/pick";

type ValidSchema = {
  params?: Schema;
  query?: Schema;
  body?: Schema;
};

export const validateReqSchema =
  (schema: ValidSchema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const validSchema = pick(schema, ["params", "query", "body"]);
    const object = pick(req, Object.keys(validSchema));

    try {
      const { value }: ValidationResult<any> = await Joi.compile(validSchema)
        .prefs({ errors: { label: "key" }, abortEarly: false })
        .validateAsync(object);

      Object.assign(req, value);
      return next();
    } catch (error) {
      const errorMessage = error.details
        .map((details) => details.message)
        .join(", ");
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: errorMessage });
    }
  };

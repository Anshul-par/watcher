import express from "express";
import { validateReqSchema } from "../middlewares/validateReqSchema";
import {
  validate_login_schema,
  validate_register_schema,
} from "../validators/auth.validators";
import {
  loginController,
  registerController,
} from "../controllers/auth.controller";
import { validateJWT } from "../middlewares/validateJWT";
import { validateAdmin } from "../middlewares/validateIsAdmin";
import { StatusCodes } from "http-status-codes";

const authRouter = express.Router();

authRouter.post(
  "/register",
  validateReqSchema(validate_register_schema),
  validateJWT,
  validateAdmin,
  registerController
);
authRouter.get("/validate", validateJWT, (_, res) => {
  res.status(StatusCodes.OK).json({ message: "Valid JWT", success: true });
});
authRouter.post(
  "/login",
  validateReqSchema(validate_login_schema),
  loginController
);

export { authRouter };

import express from "express";
import {
  adminRegisterController,
  adminLoginController,
} from "../controllers/auth.controller";

const authRouter = express.Router();

authRouter.post("/register", adminRegisterController);
authRouter.post("/login", adminLoginController);

export { authRouter };

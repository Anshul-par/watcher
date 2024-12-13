import express from "express";
import { createUrlController } from "../controllers/url.controller";

const urlRouter = express.Router();

urlRouter.post("/", createUrlController);

export { urlRouter };

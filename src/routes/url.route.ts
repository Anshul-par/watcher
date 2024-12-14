import express from "express";
import {
  createUrlController,
  getUrlController,
} from "../controllers/url.controller";

const urlRouter = express.Router();

urlRouter.post("/", createUrlController);
urlRouter.get("/", getUrlController);

export { urlRouter };

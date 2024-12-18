import express from "express";
import {
  createUrlController,
  deleteUrlController,
  getUrlController,
  updateUrlController,
} from "../controllers/url.controller";

const urlRouter = express.Router();

urlRouter.post("/", createUrlController);
urlRouter.get("/", getUrlController);
urlRouter.delete("/:id", deleteUrlController);
urlRouter.patch("/:id", updateUrlController);

export { urlRouter };

import express from "express";
import { StatusCodes } from "http-status-codes";
import { urlRouter } from "./url.route";
import { projectRouter } from "./project.route";

const rootRouter = express.Router();

rootRouter.get("/", (_, res) => {
  res
    .status(StatusCodes.OK)
    .json({ message: "Welcome to the API", success: true });
});

rootRouter.use("/url", urlRouter);
rootRouter.use("/project", projectRouter);

export { rootRouter };

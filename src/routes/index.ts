import express from "express";
import { StatusCodes } from "http-status-codes";
import { urlRouter } from "./url.route";
import { projectRouter } from "./project.route";
import { utilityRouter } from "./utility";

const rootRouter = express.Router();

rootRouter.use("/url", urlRouter);
rootRouter.use("/project", projectRouter);
rootRouter.use("/utility", utilityRouter);

rootRouter.get("/", (_, res) => {
  res
    .status(StatusCodes.OK)
    .json({ message: "Welcome to the API", success: true });
});

export { rootRouter };

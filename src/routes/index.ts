import express from "express";
import { StatusCodes } from "http-status-codes";
import { urlRouter } from "./url.route";
import { projectRouter } from "./project.route";
import { utilityRouter } from "./utility";
import { healthRouter } from "./health";
import { userRouter } from "./user";
import { authRouter } from "./auth.route";
import { jobRouter } from "./job.route";
import { dashRouter } from "./dashboard";

const rootRouter = express.Router();

rootRouter.use("/url", urlRouter);
rootRouter.use("/user", userRouter);
rootRouter.use("/project", projectRouter);
rootRouter.use("/utility", utilityRouter);
rootRouter.use("/health", healthRouter);
rootRouter.use("/auth", authRouter);
rootRouter.use("/job", jobRouter);
rootRouter.use("/dash", dashRouter);

rootRouter.get("/", async (_, res) => {
  res
    .status(StatusCodes.OK)
    .json({ message: "Welcome to the API", success: true });
});

export { rootRouter };

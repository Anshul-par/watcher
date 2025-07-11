import express from "express";
import { createJobController } from "../controllers/job.controller";

const jobRouter = express.Router();

jobRouter.post("/", createJobController);

export { jobRouter };

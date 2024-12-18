import express from "express";
import {
  getHealthController,
  getLiveHealthController,
} from "../controllers/health.controller";

const healthRouter = express.Router();

healthRouter.get("/", getHealthController);
healthRouter.get("/live", getLiveHealthController);

export { healthRouter };

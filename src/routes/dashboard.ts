import express from "express";
import { validateJWT } from "../middlewares/validateJWT";
import {
  averageResponseTimeController,
  getTotalEntitiesController,
} from "../controllers/dashboard.controller";

export const dashRouter = express.Router();

dashRouter.get("/", getTotalEntitiesController);
dashRouter.get("/:id", averageResponseTimeController);
// dashRouter.get("/incidents");

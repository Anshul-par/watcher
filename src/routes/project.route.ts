import express from "express";
import {
  createProjectController,
  getProjectController,
} from "../controllers/project.controller";

const projectRouter = express.Router();

projectRouter.post("/", createProjectController);
projectRouter.get("/", getProjectController);

export { projectRouter };

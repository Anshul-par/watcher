import express from "express";
import { createProjectController } from "../controllers/project.controller";

const projectRouter = express.Router();

projectRouter.post("/", createProjectController);

export { projectRouter };

import express from "express";
import {
  createProjectController,
  getProjectController,
  updateProjectController,
} from "../controllers/project.controller";
import { validateReqSchema } from "../middlewares/validateReqSchema";
import {
  validate_create_project,
  validate_update_project,
} from "../validators/project.validators";

const projectRouter = express.Router();

projectRouter.post(
  "/",
  validateReqSchema(validate_create_project),
  createProjectController
);
projectRouter.get("/", getProjectController);
projectRouter.patch(
  "/:id",
  validateReqSchema(validate_update_project),
  updateProjectController
);

export { projectRouter };

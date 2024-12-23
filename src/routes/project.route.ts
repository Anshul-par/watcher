import express from "express";
import {
  createProjectController,
  deleteProjectController,
  getProjectController,
  updateProjectController,
} from "../controllers/project.controller";
import { validateReqSchema } from "../middlewares/validateReqSchema";
import {
  validate_create_project,
  validate_update_project,
} from "../validators/project.validators";
import { deleteProject } from "../services/project.service";
import { valiadte_param_id } from "../validators/custom";

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
projectRouter.delete(
  "/:id",
  validateReqSchema(valiadte_param_id),
  deleteProjectController
);

export { projectRouter };

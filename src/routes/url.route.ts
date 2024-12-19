import express from "express";
import {
  createUrlController,
  deleteUrlController,
  getUrlController,
  updateUrlController,
} from "../controllers/url.controller";
import { validateReqSchema } from "../middlewares/validateReqSchema";
import {
  validate_create_url,
  validate_update_url,
} from "../validators/url.validators";
import { valiadte_param_id } from "../validators/custom";

const urlRouter = express.Router();

urlRouter.post(
  "/",
  validateReqSchema(validate_create_url),
  createUrlController
);
urlRouter.get("/", getUrlController);
urlRouter.delete(
  "/:id",
  validateReqSchema(valiadte_param_id),
  deleteUrlController
);
urlRouter.patch(
  "/:id",
  validateReqSchema(validate_update_url),
  updateUrlController
);

export { urlRouter };

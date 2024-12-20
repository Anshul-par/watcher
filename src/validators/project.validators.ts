import joi from "joi";
import { Joi_ObjectId } from "./custom";

export const validate_create_project = {
  body: joi
    .object({
      name: joi.string().required().trim(),
      description: joi.string().optional().allow("").trim(),
      owner: joi.custom(Joi_ObjectId).required(),
    })
    .required(),
};

export const validate_update_project = {
  params: joi
    .object({
      id: joi.custom(Joi_ObjectId).required(),
    })
    .required(),
  body: joi
    .object({
      name: joi.string().optional().trim(),
      description: joi.string().optional().trim(),
      owner: joi.custom(Joi_ObjectId).optional(),
    })
    .min(1)
    .required(),
};

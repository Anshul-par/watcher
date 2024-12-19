import joi from "joi";
import { Joi_ObjectId } from "./custom";

export const validate_create_project = {
  body: joi
    .object({
      name: joi.string().required().trim(),
      description: joi.string().required().trim(),
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
      name: joi.string().required().trim(),
      description: joi.string().required().trim(),
      owner: joi.custom(Joi_ObjectId).required(),
    })
    .required(),
};

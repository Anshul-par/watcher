import Joi from "joi";
import { Joi_ObjectId } from "./custom";

export const validate_url = Joi.object({
  name: Joi.string().required().trim(),
  url: Joi.string().uri().required().trim(),
  urlWithIpPort: Joi.string().uri().required().trim(),
  headers: Joi.object().default({}),
  body: Joi.object().default({}),
  cronSchedule: Joi.number().integer().min(1).default(3600),
  timeout: Joi.number().integer().min(1).default(15),
  method: Joi.string()
    .valid("GET", "POST", "PUT", "PATCH", "DELETE")
    .required(),
  project: Joi.custom(Joi_ObjectId).optional(),
});

export const validate_create_url = {
  body: validate_url.required(),
};

export const validate_update_url = {
  params: Joi.object()
    .keys({
      id: Joi.custom(Joi_ObjectId).required(),
    })
    .required(),
  body: validate_url.required(),
};

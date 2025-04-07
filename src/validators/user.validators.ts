import Joi from "joi";
import { Joi_ObjectId } from "./custom";

export const validate_user = Joi.object({
  name: Joi.string().required().trim(),
  title: Joi.string().required().trim(),
  slackUserId: Joi.string().required().trim(),
});

export const validate_create_user = {
  body: Joi.object({
    name: Joi.string().required().trim(),
    title: Joi.string().optional().allow(""),
    slackUserId: Joi.string().required().trim(),
  }).required(),
};

export const validate_update_user = {
  params: Joi.object()
    .keys({
      id: Joi.custom(Joi_ObjectId).required(),
    })
    .required(),
  body: Joi.object({
    name: Joi.string().optional().trim(),
    title: Joi.string().optional().allow(""),
    slackUserId: Joi.string().optional().trim(),
  }).min(1),
};

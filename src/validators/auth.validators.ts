import Joi from "joi";

export const validate_login_schema = {
  body: Joi.object({
    name: Joi.string().required().trim(),
    password: Joi.string().required().trim(),
  }),
};

export const validate_register_schema = {
  body: Joi.object({
    name: Joi.string().required().lowercase().trim(),
    slackId: Joi.string().required().trim(),
    password: Joi.string().required().min(6).trim(),
  }),
};

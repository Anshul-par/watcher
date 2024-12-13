import Joi from "joi";

export const Joi_ObjectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" must be a valid DB id.');
  }
  return value;
};

export const valiadte_param_id = {
  params: Joi.object()
    .keys({
      id: Joi.custom(Joi_ObjectId).required(),
    })
    .required(),
};

import { Response, Request } from "express";
import Joi, { isError } from "joi";
import jwt, { Secret } from "jsonwebtoken";
import { get as _get } from "lodash";
import {
  getPopulatedUserById,
  getUserByFirstName,
  saveUser,
} from "../services/user.service";
import { UserModel } from "../models/user.model";

const loginSchema = Joi.object({
  name: Joi.string()
    .required()
    .lowercase()
    .external(async (v: string) => {
      const user = await getUserByFirstName(v);
      if (!user) {
        throw new Error(
          "This username is not registered. Please use a registered username."
        );
      }
      return v;
    }),
  password: Joi.string().required(),
});

const registerSchema = Joi.object({
  name: Joi.string().required().lowercase(),
  slackId: Joi.string().required(),
  password: Joi.string()
    .required()
    .min(6)
    .custom((v) => {
      return jwt.sign(v, process.env.JWT_SECRET as Secret);
    }),
});

export const adminRegisterController = async (req: Request, res: Response) => {
  try {
    const payloadValue = await registerSchema
      .validateAsync(req.body)
      .then((value) => {
        return value;
      })
      .catch((e) => {
        console.log(e);
        if (isError(e)) {
          res.status(422).json(e);
        } else {
          res.status(422).json({ message: e.message });
        }
      });
    if (!payloadValue) {
      return;
    }

    let userCheck = await getUserByFirstName(payloadValue.name);
    if (userCheck) {
      res.status(422).json({ message: "User already exists" });
      return;
    }

    await saveUser(
      new UserModel({
        ...payloadValue,
        slackUserId: payloadValue.slackId,
      })
    );
    let user = await getUserByFirstName(payloadValue.name);

    const newUser = await getPopulatedUserById(user._id.toString());
    const token = jwt.sign(
      { id: user._id?.toString() },
      process.env.JWT_SECRET as Secret
    );
    res.status(200).set({ "x-auth-token": token }).json(newUser);
    return;
  } catch (error) {
    console.log("error in register", error);
    res.status(500).json({
      message: "Something happened wrong try again after sometime.",
      error: _get(error, "message"),
    });
    return;
  }
};

export const adminLoginController = async (req: Request, res: Response) => {
  try {
    const payloadValue = await loginSchema
      .validateAsync(req.body)
      .then((value) => {
        return value;
      })
      .catch((e) => {
        console.log(e);
        if (isError(e)) {
          res.status(422).json(e);
        } else {
          res.status(422).json({ message: e.message });
        }
      });

    if (!payloadValue) {
      return;
    }
    let user = await getUserByFirstName(payloadValue.name);
    const password = jwt.verify(
      user.password,
      process.env.JWT_SECRET as Secret
    );
    if (password !== payloadValue.password) {
      res.status(422).json({ message: "Password is incorrect" });
      return;
    }

    const populatedUser = await getPopulatedUserById(user._id.toString());

    const token = jwt.sign(
      { id: user._id?.toString() },
      process.env.JWT_SECRET as Secret
    );
    res.status(200).setHeader("x-auth-token", token).json(populatedUser);
    return;
  } catch (error) {
    console.log("error", "error in Admin_Login", error);
    res.status(500).json({
      message: "Something happened wrong try again after sometime.",
      error: _get(error, "message"),
    });
    return;
  }
};

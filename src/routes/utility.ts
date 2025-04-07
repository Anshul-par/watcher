import express from "express";
import { APIError } from "../errors/apiError";
import { StatusCodes } from "http-status-codes";

const utilityRouter = express.Router();

utilityRouter.get("/timeout", async (req, res) => {
  const { t } = req.query;

  await new Promise((resolve) => setTimeout(resolve, (Number(t) + 2) * 1000));

  res.status(200).send("OK");
});

utilityRouter.get("/error", async (req, res) => {
  throw new APIError(
    StatusCodes.INTERNAL_SERVER_ERROR,
    "This is a sample error"
  );
});

export { utilityRouter };

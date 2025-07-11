// CATCH ASYNC ERRORS IN EXPRESS WITHOUT USING TRY/CATCH BLOCK
require("express-async-errors");

// LOAD ENV VARS
require("dotenv").config();

import cors from "cors";
import express from "express";
import { startServer } from "./utility/startServer";
import { APIError } from "./errors/apiError";
import { StatusCodes } from "http-status-codes";
import { errorMiddleware } from "./middlewares/errorMiddleware";
import { rootRouter } from "./routes";
import { consumerForDeadLettersQueue } from "./broker";
import { subscribeToNotifications } from "./utility/listensToRedisEvenst";

const app = express();
const port = Number(process.env.PORT) || 3001;

// FOR LOGGING REQUESTS TO DEBUG
app.use((req, _, next) => {
  const info = `${req.method} ${req.url}`;
  console.log(
    new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }),
    ":: API HIT ------->",
    info,
    "\n|\nv\n|\nv\n"
  );
  next();
});

// FOR PARSING REQUEST BODY
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: "x-auth-token",
  })
);

// FOR ROUTES
app.use(rootRouter);

// FOR INVALID PATHS
app.all("*", (req, _) => {
  throw new APIError(
    StatusCodes.NOT_FOUND,
    `Requested URL ${req.path} not found`
  );
});

// CENTRAL ERROR MIDDLEWARE
app.use(errorMiddleware);

startServer(app, port).then(() => subscribeToNotifications());
// .then(() => consumerForDeadLettersQueue());

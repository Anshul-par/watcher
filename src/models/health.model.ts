import { Schema, model } from "mongoose";

const healthSchema = new Schema(
  {
    url: {
      type: Schema.Types.ObjectId,
      ref: "url",
      required: true,
    },
    numberOfCronruns: {
      type: String,
      default: "0",
    },
    numberOfRetries: {
      type: String,
      default: "0",
    },
    numberOfTimeouts: {
      type: String,
      default: "0",
    },
    latestResponse: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

export const HealthModel = model("Health", healthSchema);

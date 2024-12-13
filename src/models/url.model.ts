import { Schema, model } from "mongoose";

const urlSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    urlWithIpPort: {
      type: String,
      required: true,
      trim: true,
    },
    headers: {
      type: Schema.Types.Mixed,
      default: {},
    },
    body: {
      type: Schema.Types.Mixed,
      default: {},
    },
    cronSchedule: {
      type: Number,
      default: 3600,
    },
    timeout: {
      type: Number,
      default: 15,
    },
    method: {
      type: String,
      enum: ["GET", "POST", "PATCH", "DELETE"],
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "project",
      required: true,
    },
  },
  { timestamps: true }
);

export const URLModel = model("Url", urlSchema);

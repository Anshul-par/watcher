import { Schema, model } from "mongoose";

const urlSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
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
      default: 1800,
      min: 1800,
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
      ref: "Project",
      required: true,
    },
    inProcess: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const URLModel = model("Url", urlSchema);

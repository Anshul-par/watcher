import { Schema, model } from "mongoose";

const incidentSchema = new Schema(
  {
    url: {
      type: Schema.Types.ObjectId,
      ref: "Url",
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
  },
  {
    timestamps: true,
  }
);

export const IncidentModel = model("Incident", incidentSchema);

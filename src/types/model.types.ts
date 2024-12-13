import { Types } from "mongoose";

export interface IURL {
  _id: Types.ObjectId;
  url: string;
  urlWithIpPort: string;
  headers: Record<string, any>;
  body: Record<string, any>;
  cronSchedule: number;
  timeout: number;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  project: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProject {
  name: string;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

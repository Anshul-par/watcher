import { Types } from "mongoose";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  slackUserId: string;
  title: string;
  password: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IURL {
  _id: Types.ObjectId;
  url: string;
  urlWithIpPort: string;
  headers?: Record<string, any>;
  body?: Record<string, any>;
  cronSchedule: number;
  timeout: number;
  inProcess?: boolean;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  project: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface IIncident {
  _id?: Types.ObjectId;
  url: string;
  reason: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProject {
  name: string;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IHealth {
  url: Types.ObjectId;
  numberOfCronruns: number;
  numberOfRetries: number;
  numberOfTimeouts: number;
  latestResponse: any;
  unix: number;
  createdAt?: Date;
  updatedAt?: Date;
}

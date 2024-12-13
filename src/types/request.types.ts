import { Request as ExpresesRequest } from "express";

export interface Request extends ExpresesRequest {
  userId?: string;
  admin?: boolean;
}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

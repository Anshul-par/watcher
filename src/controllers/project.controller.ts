import { StatusCodes } from "http-status-codes";
import { IProject } from "../types/model.types";
import { Request } from "../types/request.types";
import { Response } from "express";
import {
  createProject,
  deleteProject,
  findProject,
  updateProject,
} from "../services/project.service";

export const createProjectController = async (req: Request, res: Response) => {
  const payload: IProject = req.body;

  await createProject(payload);

  res
    .status(StatusCodes.CREATED)
    .json({ message: "Project created successfully", success: true });
};

export const getUrlController = async (req: Request, res: Response) => {
  const q: Partial<IProject> = req.query;

  const data = await findProject({
    query: q,
  });

  res
    .status(StatusCodes.OK)
    .json({ message: "Project fetched successfully", success: true, data });
};

export const updateUrlController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload: Partial<IProject> = req.body;

  await updateProject({ query: { _id: id }, update: payload });

  res
    .status(StatusCodes.OK)
    .json({ message: "Project updated successfully", success: true });
};

export const deleteUrlController = async (req: Request, res: Response) => {
  const { id } = req.params;

  await deleteProject({ query: { _id: id } });

  res
    .status(StatusCodes.OK)
    .json({ message: "Project deleted successfully", success: true });
};

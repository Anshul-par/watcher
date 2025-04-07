import { StatusCodes } from "http-status-codes";
import { addJobService } from "../services/jobs.service";
import { findUrl } from "../services/url.service";

export const createJobController = async (req, res) => {
  const { project, url } = req.body;

  if (!project || !url) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "project and url are required" });
  }

  const url_data = await findUrl({
    query: {
      _id: url,
      project: project,
    },
  });

  if (!url_data.length) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Url not found" });
  }

  // @ts-ignore
  await addJobService({ url_data: url_data[0] });

  return res
    .status(StatusCodes.CREATED)
    .json({ message: "Job created", success: true });
};

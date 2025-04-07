import moment from "moment";
import { findHealth } from "../services/health.service";
import { findProject } from "../services/project.service";
import { findUrl } from "../services/url.service";
import { StatusCodes } from "http-status-codes";
import { findIncident } from "../services/incident.service";

export const getTotalEntitiesController = async (req, res) => {
  const [totalUrls, totalUrlsInProcess, totalProjects] = await Promise.all([
    findUrl({ query: {} }),
    findUrl({ query: { inProcess: false } }),
    findProject({ query: {} }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalUrls: totalUrls.length,
      totalUrlsInProcess: totalUrlsInProcess.length,
      totalProjects: totalProjects.length,
    },
  });
};

export const averageResponseTimeController = async (req, res) => {
  const urlId = req.params.id;

  const today = moment().endOf("day");
  const sevenDaysAgo = moment().subtract(6, "days").startOf("day");

  // Fetch UrlHealth documents for the last 7 days
  const healthDocs = await findHealth({
    query: {
      url: urlId,
      createdAt: {
        $gte: sevenDaysAgo.toDate(),
        $lte: today.toDate(),
      },
    },
  });

  const dailyAverages = healthDocs.map((doc) => {
    const date = moment(doc.createdAt).format("YYYY-MM-DD");
    const responses = doc.latestResponse || [];

    const total = responses.reduce((acc, item) => {
      const time = parseFloat(item.responseTime || "0");
      return acc + (isNaN(time) ? 0 : time);
    }, 0);

    const avg =
      responses.length > 0 ? (total / responses.length).toFixed(2) : null;

    return { date, avgResponseTime: avg };
  });

  const result = [];
  for (let i = 0; i < 7; i++) {
    const day = moment(sevenDaysAgo).add(i, "days").format("YYYY-MM-DD");
    const found = dailyAverages.find((d) => d.date === day);
    result.push({
      date: day,
      avgResponseTime: found ? found.avgResponseTime : null,
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: result,
    message: "Average response time fetched successfully",
  });
};

export const incidentsRecorded = async (req, res) => {
  const urlId = req.params.id;

  const start = moment().startOf("day");
  const end = moment().endOf("day");

  const incidents = await findIncident({
    query: {
      url: urlId,
      createdAt: {
        $gte: start.toDate(),
        $lte: end.toDate(),
      },
    },
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: incidents,
    message: "Incidents recorded fetched successfully",
  });
};

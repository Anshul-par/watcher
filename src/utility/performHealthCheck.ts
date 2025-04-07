import axios, { AxiosResponse, AxiosError } from "axios";
import { Types } from "mongoose";
import { pickRandomHeaders } from "./pickRandomHeaders";

// Define the interface for the URL health check task
interface UrlHealthCheckTask {
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

// Define the health check result interface
export interface IUrlHealthCheckResult {
  taskId: string;
  url_id: string;
  url: string;
  timestamp: number;
  responseTime: number;
  statusCode: number;
  isSuccess: boolean;
  errorMessage?: string;
  responseSize: number;
  contentType?: string;
  headers?: Record<string, string>;
  requestMethod: string;
}

export async function performUrlHealthCheck(
  task: UrlHealthCheckTask
): Promise<IUrlHealthCheckResult> {
  const startTime = Date.now();

  try {
    // Prepare axios request configuration
    const requestConfig = {
      method: task.method,
      url: task.url,
      headers: {
        ...(task.headers || {}),
        ...pickRandomHeaders(task._id.toString()),
      },
      data: task.body || {},
      timeout: task.timeout * 1000, // convert to milliseconds
      validateStatus: () => true,
    };

    // Perform the request
    const response: AxiosResponse = await axios(requestConfig);
    const responseTime = Date.now() - startTime;

    // Prepare health check result
    const result: IUrlHealthCheckResult = {
      taskId: task._id.toString(),
      url_id: task._id.toString(),
      url: task.url,
      timestamp: Date.now(),
      responseTime,
      statusCode: response.status,
      isSuccess: response.status >= 200 && response.status < 500,
      responseSize: parseInt(response.headers["content-length"] || "0"),
      contentType: response.headers["content-type"],
      headers: Object.fromEntries(
        Object.entries(response.headers).map(([key, value]) => [
          key,
          String(value),
        ])
      ),
      requestMethod: task.method,
    };

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      const isConnResetError = axiosError.message.includes("ECONNRESET");

      return {
        taskId: task._id.toString(),
        url_id: task._id.toString(),
        url: task.url,
        timestamp: Date.now(),
        responseTime,
        statusCode: axiosError.response?.status || 500,
        isSuccess: isConnResetError || false,
        errorMessage: axiosError.message,
        responseSize: 0,
        requestMethod: task.method,
      };
    }

    // Non-Axios error
    return {
      taskId: task._id.toString(),
      url_id: task._id.toString(),
      url: task.url,
      timestamp: Date.now(),
      responseTime,
      statusCode: 500,
      isSuccess: false,
      errorMessage: "Unknown error",
      responseSize: 0,
      requestMethod: task.method,
    };
  }
}

import axios, { AxiosResponse, AxiosError } from "axios"
import { Types } from "mongoose"

// Define the interface for the URL health check task
interface UrlHealthCheckTask {
  _id: Types.ObjectId
  url: string
  urlWithIpPort: string
  headers: Record<string, any>
  body: Record<string, any>
  cronSchedule: number
  timeout: number
  method: "GET" | "POST" | "PATCH" | "DELETE"
  project: Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

// Define the health check result interface
export interface IUrlHealthCheckResult {
  taskId: string
  url_id: string
  url: string
  timestamp: number
  responseTime: number
  statusCode: number
  isSuccess: boolean
  errorMessage?: string
  responseSize: number
  contentType?: string
  headers?: Record<string, string>
  requestMethod: string
  isTimeout: boolean // New flag to indicate if the request timed out
}

export async function performUrlHealthCheck(
  task: UrlHealthCheckTask
): Promise<IUrlHealthCheckResult> {
  const startTime = Date.now()

  try {
    // Prepare axios request configuration
    const requestConfig = {
      method: task.method,
      url: task.url,
      headers: task.headers || {},
      data: task.body || {},
      timeout: task.timeout * 1000, // convert to milliseconds
      validateStatus: () => true,
    }

    // Perform the request
    const response: AxiosResponse = await axios(requestConfig)

    // Calculate response time
    const responseTime = Date.now() - startTime

    // Prepare health check result
    const result: IUrlHealthCheckResult = {
      taskId: task._id.toString(),
      url_id: task._id.toString(),
      url: task.url,
      timestamp: Date.now(),
      responseTime,
      statusCode: response.status,
      isSuccess: response.status >= 200 && response.status < 500,
      responseSize: response.headers["content-length"] || 0,
      contentType: response.headers["content-type"],
      headers: Object.fromEntries(
        Object.entries(response.headers).map(([key, value]) => [
          key,
          String(value),
        ])
      ),
      requestMethod: task.method,
      isTimeout: false, // Initially set to false, will change if timeout occurs
    }

    return result
  } catch (error) {
    const responseTime = Date.now() - startTime

    if (error.isAxiosError) {
      const axiosError = error as AxiosError

      // Handle timeout scenario
      if (axiosError.code === "ECONNABORTED") {
        return {
          taskId: task._id.toString(),
          url_id: task._id.toString(),
          url: task.url,
          timestamp: Date.now(),
          responseTime,
          statusCode: 0,
          isSuccess: false,
          errorMessage: "Request Timeout",
          responseSize: 0,
          requestMethod: task.method,
          isTimeout: true, // Mark as timeout
        }
      }

      // Handle other errors
      return {
        taskId: task._id.toString(),
        url_id: task._id.toString(),
        url: task.url,
        timestamp: Date.now(),
        responseTime,
        statusCode: axiosError.response?.status || 500,
        isSuccess: false,
        errorMessage: axiosError.message,
        responseSize: 0,
        requestMethod: task.method,
        isTimeout: false,
      }
    }

    // If not an AxiosError, return generic result
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
      isTimeout: false,
    }
  }
}

import { connect, TLSSocket } from "tls"
import { TimezoneService } from "../services/timezone.service"

interface SSLInfo {
  valid: boolean
  aDayBeforeExpiresUnix: number | null
  daysToExpiration: number | null
  issuer: string | null
  issuedTo: string | null
  expirationDate: Date | null
  error?: string
}

interface Certificate {
  valid_to: string
  issuer: { CN?: string; [key: string]: any }
  subject: { CN?: string; [key: string]: any }
}

/**
 * Checks the SSL certificate of a given hostname.
 * @param hostname - The hostname to check (e.g., "example.com")
 * @param options - Optional configuration for the SSL check
 * @returns Promise<SSLInfo> - Information about the SSL certificate
 */
export async function checkSSLCertificate(
  url: string,
  options: { timeout?: number; port?: number } = {}
): Promise<SSLInfo> {
  const { timeout = 10000, port = 443 } = options

  return new Promise((resolve) => {
    const hostname = new URL(url).hostname
    const protocol = new URL(url).protocol
    // Input validation
    if (!hostname || typeof hostname !== "string" || protocol !== "https:") {
      resolve({
        valid: false,
        aDayBeforeExpiresUnix: null,
        daysToExpiration: null,
        issuer: null,
        issuedTo: null,
        expirationDate: null,
        error: "Invalid hostname provided",
      })
      return
    }

    let isResolved = false

    const socket: TLSSocket = connect({
      host: hostname,
      port,
      servername: hostname, // Important for SNI
      timeout,
      rejectUnauthorized: true, // Enforce certificate validation
    })

    const handleResolve = (info: SSLInfo) => {
      if (!isResolved) {
        isResolved = true
        socket.destroy() // More forceful cleanup than socket.end()
        resolve(info)
      }
    }

    socket.on("secureConnect", () => {
      try {
        const certificate = socket.getPeerCertificate(true) as Certificate

        if (certificate && Object.keys(certificate).length > 0) {
          const expirationDate = new Date(certificate.valid_to)
          const now = TimezoneService.getCurrentTimestamp() * 1000
          const daysToExpiration = Math.floor(
            (expirationDate.getTime() - now) / (1000 * 60 * 60 * 24)
          )

          handleResolve({
            valid: socket.authorized,
            aDayBeforeExpiresUnix:
              expirationDate.getTime() - now - 1000 * 60 * 60 * 24,
            daysToExpiration,
            issuer: certificate.issuer?.CN || null,
            issuedTo: certificate.subject?.CN || null,
            expirationDate,
            error: socket.authorized ? undefined : "Certificate not authorized",
          })
        } else {
          handleResolve({
            valid: false,
            aDayBeforeExpiresUnix: null,
            daysToExpiration: null,
            issuer: null,
            issuedTo: null,
            expirationDate: null,
            error: "No certificate data available",
          })
        }
      } catch (error) {
        handleResolve({
          valid: false,
          aDayBeforeExpiresUnix: null,
          daysToExpiration: null,
          issuer: null,
          issuedTo: null,
          expirationDate: null,
          error: `Certificate processing error: ${error.message}`,
        })
      }
    })

    socket.on("error", (error) => {
      handleResolve({
        valid: false,
        aDayBeforeExpiresUnix: null,
        daysToExpiration: null,
        issuer: null,
        issuedTo: null,
        expirationDate: null,
        error: `Connection error: ${error.message}`,
      })
    })

    socket.on("timeout", () => {
      handleResolve({
        valid: false,
        aDayBeforeExpiresUnix: null,
        daysToExpiration: null,
        issuer: null,
        issuedTo: null,
        expirationDate: null,
        error: "Connection timeout",
      })
    })
  })
}

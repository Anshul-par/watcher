import { Types } from "mongoose";

type AnyObject = { [key: string]: any };

/**
 * Converts all values of an object to strings.
 * Handles nested objects and arrays.
 * @param obj - The object to process.
 * @returns A new object with all values converted to strings.
 */
export function convertValuesToStrings(obj: AnyObject): AnyObject {
  if (typeof obj !== "object" || obj === null) {
    throw new Error("Input must be a non-null object");
  }

  const result: AnyObject = {};

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      // Convert array values to strings
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? JSON.stringify(item)
          : String(item)
      );
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === "object" && value !== null) {
    } else if (value instanceof Types.ObjectId) {
      result[key] = value.toString();
    } else if (typeof value === "object" && value !== null) {
      // Recursively process nested objects
      result[key] = convertValuesToStrings(value);
    } else {
      // Convert primitive values to strings
      result[key] = String(value);
    }
  }

  return result;
}

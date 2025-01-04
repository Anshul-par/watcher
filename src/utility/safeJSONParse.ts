/**
 * Utility to safely parse JSON with error handling.
 *
 * @param {string | undefined | null} jsonString - The JSON string to parse.
 * @returns {any} - Returns parsed JSON if successful, otherwise a fallback value (default is an empty object).
 */
export const safeJsonParse = (
  jsonString: string | undefined | null,
  fallback: any = []
): any => {
  if (!jsonString || typeof jsonString !== "string") {
    return fallback;
  }
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON:", error.message);
    return fallback;
  }
};

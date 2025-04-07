import axios from "axios";

const URL = "https://render-server-1941.onrender.com/check";

export const performHealthCheckViaExternalServer = async ({
  body,
  header,
  method = "GET",
  url,
  timeout = 60,
  urlId,
}: {
  body: Record<string, any>;
  header: Record<string, any>;
  method?: string;
  url: string;
  timeout?: number;
  urlId: string;
}) => {
  try {
    const { data } = await axios.post(URL, {
      body,
      header,
      method,
      url,
      timeout: 10_000,
      urlId,
    });

    return data.data;
  } catch (error) {
    console.error("Health check failed via External API:", error);
    throw error;
  }
};

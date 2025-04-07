import { GLOBAL_HEADERS_MAP } from "../server";

const randomHeaders = {
  0: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "Accept-Language": "en-US",
    "X-Request-ID": "a1b2c3d",
  },
  1: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
    Accept: "text/html",
    "Accept-Encoding": "br",
    "Accept-Language": "fr-FR",
    "X-Request-ID": "e4f5g6h",
  },
  2: {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/537.36",
    Accept: "application/xml",
    "Accept-Encoding": "identity",
    "Accept-Language": "de-DE",
    "X-Request-ID": "i7j8k9l",
  },
  3: {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 11; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36",
    Accept: "text/plain",
    "Accept-Encoding": "deflate",
    "Accept-Language": "es-ES",
    "X-Request-ID": "m1n2o3p",
  },
  4: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "Accept-Language": "en-US",
    "X-Request-ID": "q4r5s6t",
  },
  5: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
    Accept: "text/html",
    "Accept-Encoding": "br",
    "Accept-Language": "fr-FR",
    "X-Request-ID": "u7v8w9x",
  },
  6: {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/537.36",
    Accept: "application/xml",
    "Accept-Encoding": "identity",
    "Accept-Language": "de-DE",
    "X-Request-ID": "y1z2a3b",
  },
  7: {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 11; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36",
    Accept: "text/plain",
    "Accept-Encoding": "deflate",
    "Accept-Language": "es-ES",
    "X-Request-ID": "c4d5e6f",
  },
  8: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "Accept-Language": "en-US",
    "X-Request-ID": "g7h8i9j",
  },
  9: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
    Accept: "text/html",
    "Accept-Encoding": "br",
    "Accept-Language": "fr-FR",
    "X-Request-ID": "k1l2m3n",
  },
};

export const pickRandomHeaders = (urlId) => {
  const lastUsedHeadersIndex = GLOBAL_HEADERS_MAP[urlId];

  const randomPick = Math.floor(
    Math.random() * Object.keys(randomHeaders).length
  );
  if (lastUsedHeadersIndex === randomPick) {
    return pickRandomHeaders(lastUsedHeadersIndex);
  }

  GLOBAL_HEADERS_MAP[urlId] = randomPick;

  return randomHeaders[randomPick];
};

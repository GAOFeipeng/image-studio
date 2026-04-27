import { isIP } from "node:net";
import { HttpError } from "@/lib/http";

const privateIpv4Ranges = [
  [0, 0],
  [10, 10],
  [127, 127],
  [169, 169],
  [172, 172],
  [192, 192],
] as const;

export function normalizeProviderBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new HttpError(400, "Provider base URL is invalid", "invalid_provider_base_url");
  }

  assertSafeRemoteUrl(url, "Provider base URL");
  url.username = "";
  url.password = "";
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export function assertProviderPath(path: string, label: string) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.length > 200) {
    throw new HttpError(400, `${label} must be a relative API path starting with one slash`, "invalid_provider_path");
  }

  return path;
}

export function normalizeRemoteImageUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(502, "Image provider returned an invalid image URL", "invalid_image_url");
  }

  assertSafeRemoteUrl(url, "Generated image URL");
  return url.toString();
}

function assertSafeRemoteUrl(url: URL, label: string) {
  if (url.protocol !== "https:") {
    throw new HttpError(400, `${label} must use HTTPS`, "unsafe_remote_url");
  }

  const hostname = stripIpv6Brackets(url.hostname.toLowerCase());
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new HttpError(400, `${label} cannot target localhost`, "unsafe_remote_url");
  }

  if (isPrivateOrReservedIp(hostname)) {
    throw new HttpError(400, `${label} cannot target private or reserved IP addresses`, "unsafe_remote_url");
  }
}

function stripIpv6Brackets(hostname: string) {
  return hostname.replace(/^\[/, "").replace(/\]$/, "");
}

function isPrivateOrReservedIp(hostname: string) {
  const ipVersion = isIP(hostname);
  if (!ipVersion) return false;
  if (ipVersion === 6) return isUnsafeIpv6(hostname);
  return isUnsafeIpv4(hostname);
}

function isUnsafeIpv4(hostname: string) {
  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [first, second] = octets;
  if (privateIpv4Ranges.some(([start, end]) => first >= start && first <= end)) {
    if (first === 169) return second === 254;
    if (first === 172) return second >= 16 && second <= 31;
    if (first === 192) return second === 168 || second === 0;
    return true;
  }

  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  if (first >= 224) return true;
  return false;
}

function isUnsafeIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

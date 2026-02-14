import { OpenAPI } from "@zinovia/contracts";
import { getBrowserApiBaseUrl } from "./env";

OpenAPI.BASE = getBrowserApiBaseUrl();
OpenAPI.WITH_CREDENTIALS = true;

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.info("[zinovia-fans] API base URL:", OpenAPI.BASE);
}

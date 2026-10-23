import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

/**
 * Single axios instance for the swarm of auth/account calls.
 *
 * The access token is kept in memory only; the refresh token is an httpOnly
 * cookie, so `withCredentials` is enough. The response interceptor performs a
 * single-flight refresh on 401 and retries the original request once.
 */
/**
 * Base URL of the backend. Read from NEXT_PUBLIC_API_URL (frontend/.env); there
 * is no inline default so a missing value fails loudly instead of silently
 * pointing at the wrong host.
 */
const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL;

if (!configuredBaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Copy frontend/.env.example to frontend/.env.",
  );
}

export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, "");

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly errors?: string[];

  constructor(status: number, detail: string, errors?: string[]) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}

type ProblemDetail = {
  detail?: string;
  title?: string;
  errors?: string[];
};

/** Endpoints that must never trigger a silent refresh (public or refresh itself). */
const NO_REFRESH_PATHS = [
  "/api/auth/sign-in",
  "/api/auth/sign-up",
  "/api/auth/refresh-token",
  "/api/auth/sign-out",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/oauth/exchange",
];

function shouldAttemptRefresh(url?: string) {
  if (!url) return true;
  return !NO_REFRESH_PATHS.some((path) => url.includes(path));
}

function toApiError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const problem = error.response?.data as ProblemDetail | undefined;
  const detail =
    problem?.detail ??
    problem?.title ??
    (status === 0
      ? "Unable to reach the server. Check your connection and try again."
      : `Request failed with status ${status}.`);

  return new ApiError(status, detail, problem?.errors);
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Single-flight silent refresh. It uses a bare axios call so the refresh
 * request cannot recursively enter the 401 interceptor.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<{ accessToken?: string }>(
        `${API_BASE_URL}/api/auth/refresh-token`,
        null,
        { withCredentials: true },
      )
      .then((response) => {
        accessToken = response.data.accessToken ?? null;
        return accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;

    if (
      config &&
      error.response?.status === 401 &&
      !config._retry &&
      shouldAttemptRefresh(config.url)
    ) {
      config._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(config);
      }
    }

    return Promise.reject(toApiError(error));
  },
);

export default axiosInstance;

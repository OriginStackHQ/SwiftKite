import axiosInstance, { API_BASE_URL } from "./axiosInstance";

export type MeResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  providers: string[];
  hasPassword: boolean;
};

export type SessionResponse = {
  /** Only the access token is returned; the refresh token is an httpOnly cookie. */
  accessToken: string;
};

export type SignUpPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type LinkedProvider = {
  provider: string;
  linkedAt: string;
};

export type ProvidersResponse = {
  hasPassword: boolean;
  providers: LinkedProvider[];
};

export type MessageResponse = {
  message: string;
};

export const AUTH_LINK_TOKEN_KEY = "sk_oauth_link_token";

export async function signInRequest(email: string, password: string) {
  const { data } = await axiosInstance.post<SessionResponse>(
    "/api/auth/sign-in",
    { email, password },
  );
  return data;
}

export async function signUpRequest(payload: SignUpPayload) {
  const { data } = await axiosInstance.post<MeResponse>(
    "/api/auth/sign-up",
    payload,
  );
  return data;
}

export async function meRequest() {
  const { data } = await axiosInstance.get<MeResponse>("/api/auth/me");
  return data;
}

export async function signOutRequest() {
  // Public + idempotent on the server: always clears the refresh cookie.
  await axiosInstance.post("/api/auth/sign-out");
}

export async function setPasswordRequest(
  password: string,
  confirmPassword: string,
) {
  const { data } = await axiosInstance.post<SessionResponse>(
    "/api/auth/password",
    { password, confirmPassword },
  );
  return data;
}

export async function changePasswordRequest(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) {
  const { data } = await axiosInstance.post<SessionResponse>(
    "/api/auth/password/change",
    { currentPassword, newPassword, confirmPassword },
  );
  return data;
}

export async function updateProfileRequest(
  firstName: string,
  lastName: string,
) {
  const { data } = await axiosInstance.patch<MeResponse>("/api/auth/me", {
    firstName,
    lastName,
  });
  return data;
}

export async function forgotPasswordRequest(email: string) {
  const { data } = await axiosInstance.post<MessageResponse>(
    "/api/auth/forgot-password",
    { email },
  );
  return data;
}

export async function resetPasswordRequest(
  token: string,
  password: string,
  confirmPassword: string,
) {
  const { data } = await axiosInstance.post<MessageResponse>(
    "/api/auth/reset-password",
    { token, password, confirmPassword },
  );
  return data;
}

export async function exchangeOAuthCodeRequest(
  code: string,
  linkToken?: string,
) {
  const { data } = await axiosInstance.post<SessionResponse>(
    "/api/auth/oauth/exchange",
    { code, linkToken },
  );
  return data;
}

export async function providersRequest() {
  const { data } = await axiosInstance.get<ProvidersResponse>(
    "/api/auth/providers",
  );
  return data;
}

export async function linkTokenRequest() {
  const { data } = await axiosInstance.get<{ linkToken: string }>(
    "/api/auth/providers/link-token",
  );
  return data;
}

export async function unlinkProviderRequest(provider: string) {
  await axiosInstance.delete(`/api/auth/providers/${provider}`);
}

/** Starts Google sign-in (or sign-up) on the backend OAuth endpoint. */
export function startGoogleOAuth() {
  // Full-page redirect to the backend (external origin), not a Next.js route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- backend OAuth endpoint on another origin
  window.location.href = `${API_BASE_URL}/oauth2/authorization/google`;
}

/**
 * Account linking handshake: the link token proves the current account's
 * ownership and is carried in sessionStorage across the Google redirect, then
 * sent to /oauth/exchange by the callback page.
 */
export async function startGoogleLink() {
  const { linkToken } = await linkTokenRequest();
  window.sessionStorage.setItem(AUTH_LINK_TOKEN_KEY, linkToken);
  startGoogleOAuth();
}

export function takeLinkToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.sessionStorage.getItem(AUTH_LINK_TOKEN_KEY);
  window.sessionStorage.removeItem(AUTH_LINK_TOKEN_KEY);
  return token;
}

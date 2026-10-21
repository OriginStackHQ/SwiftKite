"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { getAccessToken, refreshAccessToken, setAccessToken } from "./axiosInstance";
import {
  changePasswordRequest,
  exchangeOAuthCodeRequest,
  meRequest,
  setPasswordRequest,
  signInRequest,
  signOutRequest,
  signUpRequest,
  updateProfileRequest,
  type MeResponse,
  type SignUpPayload,
} from "./auth-api";
import { authKeys } from "./query-keys";

type Session = {
  me: MeResponse;
  accessToken: string;
};

type AuthContextValue = {
  user: MeResponse | null;
  /** Roles from the access-token claim (fallback: /me). UI gating only. */
  roles: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<MeResponse>;
  signOut: () => Promise<void>;
  exchangeOAuthCode: (code: string, linkToken?: string) => Promise<void>;
  setPassword: (password: string, confirmPassword: string) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => Promise<void>;
  updateProfile: (firstName: string, lastName: string) => Promise<MeResponse>;
  refreshUser: () => Promise<void>;
  isSigningIn: boolean;
  isSigningUp: boolean;
  isSigningOut: boolean;
  isSettingPassword: boolean;
  isChangingPassword: boolean;
  isUpdatingProfile: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type SessionQueryKey = typeof authKeys.session;

/** The three generics are required by TanStack Query's tagged-key signature. */
function writeSession(
  queryClient: QueryClient,
  updater:
    | Session
    | null
    | undefined
    | ((
        current: Session | null | undefined,
      ) => Session | null | undefined),
) {
  queryClient.setQueryData<Session | null, SessionQueryKey, Session | null>(
    authKeys.session,
    updater,
  );
}

/** Decodes the `roles` claim. For display/routing only — the API still authorizes. */
function decodeRoles(token: string): string[] {
  try {
    const payload = token.split(".")[1];
    if (!payload) return [];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as { roles?: unknown };
    if (!Array.isArray(claims.roles)) return [];
    return claims.roles.filter((role): role is string => typeof role === "string");
  } catch {
    return [];
  }
}

/**
 * The access token is memory-only, so a reload starts from the httpOnly
 * refresh cookie and then hydrates the profile. Returning null (rather than
 * throwing) makes "signed out" a normal query result.
 */
async function bootstrapSession(): Promise<Session | null> {
  const token = await refreshAccessToken();
  if (!token) return null;

  setAccessToken(token);
  try {
    const me = await meRequest();
    return { me, accessToken: token };
  } catch {
    setAccessToken(null);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: authKeys.session,
    queryFn: bootstrapSession,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const session = sessionQuery.data ?? null;
  const user = session?.me ?? null;

  const roles = useMemo(() => {
    if (!session) return [];
    // Old tokens may predate the roles claim; /me is the fallback.
    const fromToken = decodeRoles(session.accessToken);
    return fromToken.length > 0 ? fromToken : session.me.roles;
  }, [session]);

  /** Stores a freshly minted token and re-reads the profile. */
  async function adoptSession(accessToken: string) {
    setAccessToken(accessToken);
    const me = await meRequest();
    writeSession(queryClient, { me, accessToken });
    return me;
  }

  function setSignedOut() {
    setAccessToken(null);
    writeSession(queryClient, null);
  }

  const signInMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signInRequest(email, password),
    onSuccess: ({ accessToken }) => adoptSession(accessToken),
  });

  const signUpMutation = useMutation({
    mutationFn: (payload: SignUpPayload) => signUpRequest(payload),
  });

  const signOutMutation = useMutation({
    mutationFn: signOutRequest,
    onSettled: setSignedOut,
  });

  const exchangeCodeMutation = useMutation({
    mutationFn: ({
      code,
      linkToken,
    }: {
      code: string;
      linkToken?: string;
    }) => exchangeOAuthCodeRequest(code, linkToken),
    onSuccess: ({ accessToken }) => adoptSession(accessToken),
  });

  const setPasswordMutation = useMutation({
    mutationFn: ({
      password,
      confirmPassword,
    }: {
      password: string;
      confirmPassword: string;
    }) => setPasswordRequest(password, confirmPassword),
    onSuccess: ({ accessToken }) => adoptSession(accessToken),
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
      confirmPassword,
    }: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => changePasswordRequest(currentPassword, newPassword, confirmPassword),
    onSuccess: ({ accessToken }) => adoptSession(accessToken),
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({
      firstName,
      lastName,
    }: {
      firstName: string;
      lastName: string;
    }) => updateProfileRequest(firstName, lastName),
    onSuccess: (me) => {
      writeSession(queryClient, (current) =>
        current ? { ...current, me } : current,
      );
    },
  });

  async function signIn(email: string, password: string) {
    await signInMutation.mutateAsync({ email, password });
  }

  async function signUp(payload: SignUpPayload) {
    return signUpMutation.mutateAsync(payload);
  }

  async function signOut() {
    try {
      await signOutMutation.mutateAsync();
    } catch {
      // Signing out locally must win even when the API is unreachable.
    } finally {
      setSignedOut();
    }
  }

  async function exchangeOAuthCode(code: string, linkToken?: string) {
    await exchangeCodeMutation.mutateAsync({ code, linkToken });
  }

  async function setPassword(password: string, confirmPassword: string) {
    await setPasswordMutation.mutateAsync({ password, confirmPassword });
  }

  async function changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    await changePasswordMutation.mutateAsync({
      currentPassword,
      newPassword,
      confirmPassword,
    });
  }

  async function updateProfile(firstName: string, lastName: string) {
    return updateProfileMutation.mutateAsync({ firstName, lastName });
  }

  async function refreshUser() {
    const me = await meRequest();
    const accessToken = getAccessToken() ?? session?.accessToken;
    if (accessToken) {
      writeSession(queryClient, { me, accessToken });
    }
  }

  const value: AuthContextValue = {
    user,
    roles,
    isLoading: sessionQuery.isPending,
    isAuthenticated: session !== null,
    signIn,
    signUp,
    signOut,
    exchangeOAuthCode,
    setPassword,
    changePassword,
    updateProfile,
    refreshUser,
    isSigningIn: signInMutation.isPending,
    isSigningUp: signUpMutation.isPending,
    isSigningOut: signOutMutation.isPending,
    isSettingPassword: setPasswordMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}

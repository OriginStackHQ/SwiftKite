/** Central query keys so auth screens invalidate exactly what they change. */
export const authKeys = {
  session: ["auth", "session"] as const,
  providers: ["auth", "providers"] as const,
};

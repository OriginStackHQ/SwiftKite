/** Central query keys so auth screens invalidate exactly what they change. */
export const authKeys = {
  session: ["auth", "session"] as const,
  providers: ["auth", "providers"] as const,
};

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: () => [...campaignKeys.all, "list"] as const,
  defaults: () => [...campaignKeys.all, "defaults"] as const,
  detail: (id: string) => [...campaignKeys.all, "detail", id] as const,
  recipients: (id: string) => [...campaignKeys.all, "recipients", id] as const,
  deliveries: (id: string, status: string, page: number) =>
    [...campaignKeys.all, "deliveries", id, status, page] as const,
};

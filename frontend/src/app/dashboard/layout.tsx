import { AppShell } from "@/components/newsflow/shell";
import { RequireAuth } from "@/components/newsflow/require-auth";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

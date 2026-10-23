import { AppShell } from "@/components/swiftkite/shell";
import { RequireAuth } from "@/components/swiftkite/require-auth";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

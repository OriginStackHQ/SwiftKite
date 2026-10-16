import { AppShell } from "@/components/newsflow/shell";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return <AppShell>{children}</AppShell>;
}

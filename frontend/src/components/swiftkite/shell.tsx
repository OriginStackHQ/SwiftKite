"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  LogOut,
  Mail,
  Menu,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Brand } from "./ui";
import { useTheme } from "./theme";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useAuth } from "@/lib/auth";

const nav = [
  { to: "/dashboard", label: "Overview", icon: Home },
  { to: "/dashboard/campaigns", label: "Campaigns", icon: Mail },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [command, setCommand] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const campaignsQuery = useCampaigns();
  const campaigns = campaignsQuery.data?.content ?? [];
  const sending = campaigns.some((campaign) => campaign.status === "SENDING");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommand(true);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- closes the mobile drawer after navigation
  useEffect(() => setMobile(false), [path]);

  const displayName = user ? `${user.firstName} ${user.lastName}` : "Account";
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "U";

  const go = (to: string) => {
    setCommand(false);
    router.push(to);
  };

  return (
    <div className="app-shell">
      {mobile && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-20 bg-overlay md:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`sidebar ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-open" : ""}`}
        aria-label="Primary navigation"
      >
        <Link href="/dashboard" aria-label="SwiftKite overview">
          <Brand />
        </Link>
        <nav className="sidebar-nav">
          {nav.map((item) => (
            <Link
              key={item.to}
              href={item.to}
              data-status={
                (item.to === "/dashboard" ? path === "/dashboard" : path.startsWith(item.to))
                  ? "active"
                  : undefined
              }
              className="nav-item"
              title={item.label}
            >
              <item.icon size={18} />
              <span className="nav-label flex-1">{item.label}</span>
              {item.label === "Campaigns" && sending && (
                <span className="nav-label flex items-center gap-1 text-[10px] text-info">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info" />
                  Sending
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 border-t pt-4 text-left">
                <span className="avatar">{initials}</span>
                <span className="user-label min-w-0">
                  <span className="block truncate text-xs font-semibold">{displayName}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{user?.email}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <AccountMenu />
          </DropdownMenu>
        </div>
      </aside>
      <div className={`workspace-body ${collapsed ? "narrow" : ""}`}>
        <header className="topbar">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              className="mobile-menu"
              size="icon"
              variant="ghost"
              aria-label="Open menu"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <Button
              className="hidden md:inline-flex"
              size="icon"
              variant="ghost"
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeft />
            </Button>
            <button
              className="top-search flex h-9 w-full max-w-md items-center gap-2 rounded-md border bg-background px-3 text-xs text-muted-foreground"
              onClick={() => setCommand(true)}
            >
              <Search size={15} />
              <span className="truncate">Search or jump to...</span>
              <kbd className="ml-auto hidden font-mono text-[10px] sm:inline">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="avatar ml-1" aria-label="Account menu">
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <AccountMenu />
            </DropdownMenu>
          </div>
        </header>
        <main className="workspace-main route-enter" key={path}>
          {children}
        </main>
      </div>
      <CommandDialog open={command} onOpenChange={setCommand}>
        <CommandInput placeholder="Search campaigns or jump to a page..." />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go("/dashboard/campaigns/new")}>
              <Plus />
              Create campaign
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Navigate">
            {nav.map((item) => (
              <CommandItem key={item.to} onSelect={() => go(item.to)}>
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Campaigns">
            {campaigns.slice(0, 8).map((campaign) => (
              <CommandItem
                key={campaign.id}
                onSelect={() => go(`/dashboard/campaigns/${campaign.id}`)}
              >
                <Mail />
                {campaign.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

function AccountMenu() {
  const { signOut } = useAuth();
  const router = useRouter();
  return (
    <DropdownMenuContent align="end" className="w-52 bg-card">
      <DropdownMenuLabel>SwiftKite account</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
        <Settings />
        Settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={async () => {
          await signOut();
          toast.success("Signed out");
          router.push("/sign-in");
        }}
      >
        <LogOut />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronDown,
  FileText,
  Home,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Brand } from "./ui";
import { useDemo } from "./store";
import { useAuth } from "@/lib/auth";
import { CreatePublicationDialog } from "./publication-dialog";
const nav = [
  { to: "/dashboard", label: "Overview", icon: Home },
  { to: "/dashboard/publications", label: "Publications", icon: FileText },
  { to: "/dashboard/subscribers", label: "Subscribers", icon: Users },
  { to: "/dashboard/campaigns", label: "Campaigns", icon: Mail },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [command, setCommand] = useState(false),
    [create, setCreate] = useState(false),
    [search, setSearch] = useState("");
  const path = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const {
    publications,
    publicationId,
    setPublicationId,
    subscribers,
    campaigns,
    theme,
    setTheme,
  } = useDemo();
  const sending = campaigns.some((c) => c.status === "Sending");
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand(true);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- closes the mobile drawer after client-side navigation
  useEffect(() => setMobile(false), [path]);
  const selected = publications.find((p) => p.id === publicationId);
  const displayName = user ? `${user.firstName} ${user.lastName}` : "Account";
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "U";
  const filteredPubs = publications.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const count = (id: string) =>
    subscribers.filter((s) => s.publicationId === id && s.status === "Active")
      .length;
  const go = (to: (typeof nav)[number]["to"] | "/dashboard/campaigns/new") => {
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
        <Link href="/dashboard" aria-label="NewsFlow overview">
          <Brand />
        </Link>
        <Popover>
          <PopoverTrigger asChild>
            <button className="mt-7 flex h-12 items-center gap-2 rounded-md border bg-card px-2 text-left">
              <span className="pub-icon primary h-8 w-8 text-xs">
                {selected?.name[0] || "A"}
              </span>
              <span className="switch-label min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  {selected?.name || "All publications"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {selected
                    ? count(selected.id)
                    : subscribers.filter((s) => s.status === "Active")
                        .length}{" "}
                  active readers
                </span>
              </span>
              <ChevronDown className="switch-label" size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 bg-card p-2">
            <Input
              autoFocus
              placeholder="Search publications"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="mt-2 flex w-full rounded p-2 text-sm hover:bg-muted"
              onClick={() => setPublicationId("all")}
            >
              All publications
            </button>
            {filteredPubs.map((p) => (
              <button
                className="flex w-full items-center justify-between rounded p-2 text-sm hover:bg-muted"
                key={p.id}
                onClick={() => setPublicationId(p.id)}
              >
                <span>{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {count(p.id)}
                </span>
              </button>
            ))}
            <Button
              className="mt-2 w-full"
              variant="outline"
              onClick={() => setCreate(true)}
            >
              <Plus />
              Create publication
            </Button>
          </PopoverContent>
        </Popover>
        <nav className="sidebar-nav">
          {nav.map((item) => (
            <Link
              key={item.to}
              href={item.to}
              data-status={
                (
                  item.to === "/dashboard"
                    ? path === "/dashboard"
                    : path.startsWith(item.to)
                )
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
                  <span className="block truncate text-xs font-semibold">
                    {displayName}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {user?.email}
                  </span>
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
              <kbd className="ml-auto hidden font-mono text-[10px] sm:inline">
                ⌘K
              </kbd>
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className="relative"
                  size="icon"
                  variant="ghost"
                  aria-label="Notifications"
                >
                  <Bell />
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 bg-card">
                <p className="mb-3 text-sm font-semibold">Notifications</p>
                {[
                  "A small team, meaningful work completed",
                  "Bounce suppressed for an invalid address",
                  "Weekly Digest remains paused",
                ].map((t, i) => (
                  <p key={t} className="border-t py-3 text-xs">
                    {t}
                    <span className="block text-muted-foreground">
                      {i + 2} hours ago
                    </span>
                  </p>
                ))}
              </PopoverContent>
            </Popover>
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
        <CommandInput placeholder="Search pages, campaigns or subscribers..." />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {nav.map((n) => (
              <CommandItem key={n.to} onSelect={() => go(n.to)}>
                <n.icon />
                {n.label}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => go("/dashboard/campaigns/new")}>
              <Plus />
              Create campaign
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Subscribers">
            {subscribers.slice(0, 6).map((s) => (
              <CommandItem
                key={s.id}
                onSelect={() => go("/dashboard/subscribers")}
              >
                {s.email}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <CreatePublicationDialog open={create} onOpenChange={setCreate} />
    </div>
  );
}
function AccountMenu() {
  const { setTheme } = useDemo();
  const { signOut } = useAuth();
  const router = useRouter();
  return (
    <DropdownMenuContent align="end" className="w-52 bg-card">
      <DropdownMenuLabel>Workspace account</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
        <Settings />
        Profile
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => setTheme("light")}>
        <Sun />
        Light
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setTheme("dark")}>
        <Moon />
        Dark
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setTheme("system")}>
        <Monitor />
        System
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
export function usePublicationFilter() {
  const { publicationId } = useDemo();
  return useMemo(() => publicationId, [publicationId]);
}

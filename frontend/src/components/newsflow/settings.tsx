"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Monitor, Moon, Sun, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useDemo } from "./store";
import { ConfirmDialog, PageHeading } from "./ui";
import { PasswordStrength } from "./auth";
// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydration read of localStorage; reading it during render would cause a hydration mismatch
export function SettingsPage() {
  const store = useDemo();
  const [tab, setTab] = useState("Profile"),
    [name, setName] = useState(store.profile.name),
    [email, setEmail] = useState(store.profile.email),
    [dirty, setDirty] = useState(false),
    [notifications, setNotifications] = useState<Record<string, boolean>>({
      "Campaign completed": true,
      "High bounce rate alert": true,
      "New complaint": true,
      "Weekly summary": false,
    }),
    [savedNotifications, setSavedNotifications] = useState(notifications),
    [remove, setRemove] = useState(false),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const router = useRouter();
  useEffect(() => {
    try {
      const raw = localStorage.getItem("newsflow-notifications");
      if (raw) {
        setNotifications(JSON.parse(raw));
        setSavedNotifications(JSON.parse(raw));
      }
    } catch {}
  }, []);
  const save = () => {
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter your name and a valid email address");
      return;
    }
    store.setProfile({ name, email });
    localStorage.setItem(
      "newsflow-notifications",
      JSON.stringify(notifications),
    );
    setSavedNotifications(notifications);
    setDirty(false);
    toast.success("Demo preferences saved");
  };
  return (
    <>
      <PageHeading title="Settings" description="Your workspace, your way." />
      <div className="tab-row">
        {["Profile", "Appearance", "Notifications", "Security"].map((t) => (
          <Button
            variant="ghost"
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      <div className="grid gap-12 lg:grid-cols-[250px_1fr]">
        <aside>
          <h2 className="text-lg font-semibold">{tab}</h2>
          <p className="subtle-note mt-3">
            {tab === "Profile"
              ? "The person behind your publication."
              : tab === "Appearance"
                ? "A comfortable workspace, day or night."
                : tab === "Notifications"
                  ? "Choose what deserves your attention."
                  : "Keep your workspace secure."}
          </p>
        </aside>
        <section className="max-w-2xl space-y-6">
          {tab === "Profile" && (
            <>
              <div className="flex items-center gap-4">
                <span className="avatar h-16 w-16 text-lg">
                  {name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="subtle-note">Workspace owner · Demo account</p>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="profile-name">Full name</label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="profile-email">Email address</label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
              <div className="border-t pt-5">
                <p className="text-xs font-medium">Account information</p>
                <p className="subtle-note mt-2">
                  Member since August 2026 · Interactive demo workspace
                </p>
              </div>
            </>
          )}
          {tab === "Appearance" && (
            <>
              <p className="subtle-note">
                Choose the appearance that feels right for you.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "light", icon: Sun, label: "Light" },
                  { value: "dark", icon: Moon, label: "Dark" },
                  { value: "system", icon: Monitor, label: "System" },
                ].map((t) => (
                  <button
                    key={t.value}
                    className={`overflow-hidden rounded-lg border text-left ${store.theme === t.value ? "border-primary ring-1 ring-primary" : ""}`}
                    onClick={() => store.setTheme(t.value)}
                  >
                    <div className="flex h-24 items-center justify-center gap-2 bg-muted">
                      <t.icon
                        size={28}
                        className={
                          store.theme === t.value
                            ? "text-primary"
                            : "text-muted-foreground"
                        }
                      />
                    </div>
                    <div className="flex justify-between bg-card p-3 text-xs">
                      <span>{t.label}</span>
                      {store.theme === t.value && (
                        <Check size={13} className="text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === "Notifications" &&
            Object.entries(notifications).map(([n, v]) => (
              <div key={n} className="flex justify-between border-b py-4">
                <div>
                  <p className="text-sm font-medium">{n}</p>
                  <p className="subtle-note mt-1">
                    {n === "Weekly summary"
                      ? "A digest of your newsletter’s performance."
                      : n === "Campaign completed"
                        ? "When every recipient has been accounted for."
                        : n === "High bounce rate alert"
                          ? "When your list may need a little care."
                          : "When a recipient reports a campaign as spam."}
                  </p>
                </div>
                <Switch
                  aria-label={n}
                  checked={v}
                  onCheckedChange={(value) => {
                    setNotifications((p) => ({ ...p, [n]: value }));
                    setDirty(true);
                  }}
                />
              </div>
            ))}
          {tab === "Security" && (
            <>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock size={14} />
                Password changes are simulated in this demo.
              </p>
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    !current ||
                    password.length < 8 ||
                    !/[A-Z]/.test(password) ||
                    !/[0-9]/.test(password) ||
                    password !== confirm
                  ) {
                    toast.error(
                      "Complete the current password and matching strong new passwords",
                    );
                    return;
                  }
                  toast.success(
                    "Demo password changed — no real account modified",
                  );
                  setCurrent("");
                  setPassword("");
                  setConfirm("");
                }}
              >
                {[
                  ["Current password", current, setCurrent],
                  ["New password", password, setPassword],
                  ["Confirm new password", confirm, setConfirm],
                ].map(([label, value, set]) => (
                  <div className="form-field" key={label as string}>
                    <label htmlFor={label as string}>{label as string}</label>
                    <Input
                      id={label as string}
                      type="password"
                      required
                      value={value as string}
                      onChange={(e) =>
                        (set as (s: string) => void)(e.target.value)
                      }
                    />
                    {label === "New password" && (
                      <PasswordStrength password={password} />
                    )}
                  </div>
                ))}
                <Button type="submit">Change password (demo)</Button>
              </form>
              <div className="mt-8 border-t pt-6">
                <h3 className="text-sm font-semibold text-destructive">
                  Danger zone
                </h3>
                <p className="subtle-note my-3">
                  Delete this demo account and return to the public website.
                </p>
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setRemove(true)}
                >
                  Delete account
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
      {dirty && (
        <div className="save-bar">
          <span className="text-xs">You have unsaved changes</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setName(store.profile.name);
                setEmail(store.profile.email);
                setNotifications(savedNotifications);
                setDirty(false);
              }}
            >
              Discard
            </Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title="Delete demo account?"
        description="This is a simulated action. No real account will be deleted."
        action="Delete account (demo)"
        confirmText="DELETE"
        destructive
        onConfirm={() => {
          toast.info("Demo account deletion simulated");
          router.push("/");
        }}
      />
    </>
  );
}

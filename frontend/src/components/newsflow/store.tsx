"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  publications as initialPublications,
  subscribers as initialSubscribers,
  campaigns as initialCampaigns,
  type Publication,
  type Subscriber,
  type Campaign,
} from "@/data/mock";
import { Toaster } from "sonner";
type Store = {
  publications: Publication[];
  setPublications: React.Dispatch<React.SetStateAction<Publication[]>>;
  subscribers: Subscriber[];
  setSubscribers: React.Dispatch<React.SetStateAction<Subscriber[]>>;
  campaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  publicationId: string;
  setPublicationId: (id: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
  profile: { name: string; email: string };
  setProfile: (p: { name: string; email: string }) => void;
};
const Context = createContext<Store | null>(null);
// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydration theme init from localStorage; reading it during render would cause a hydration mismatch
export function DemoProvider({ children }: { children: ReactNode }) {
  const [publications, setPublications] = useState(initialPublications);
  const [subscribers, setSubscribers] = useState(initialSubscribers);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [publicationId, setPublicationId] = useState("all");
  const [theme, setThemeState] = useState("light");
  const [profile, setProfile] = useState({
    name: "John Doe",
    email: "john@example.com",
  });
  useEffect(() => {
    setThemeState(localStorage.getItem("newsflow-theme") || "light");
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const setTheme = (value: string) => {
    setThemeState(value);
    localStorage.setItem("newsflow-theme", value);
  };
  return (
    <Context.Provider
      value={{
        publications,
        setPublications,
        subscribers,
        setSubscribers,
        campaigns,
        setCampaigns,
        publicationId,
        setPublicationId,
        theme,
        setTheme,
        profile,
        setProfile,
      }}
    >
      {children}
      <Toaster
        position="bottom-right"
        richColors
        theme={theme === "dark" ? "dark" : "light"}
      />
    </Context.Provider>
  );
}
export function useDemo() {
  const context = useContext(Context);
  if (!context) throw new Error("NewsFlow provider missing");
  return context;
}

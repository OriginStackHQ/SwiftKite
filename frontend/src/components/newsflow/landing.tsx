"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Home,
  Mail,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  BarChart3,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Brand, MetricStrip, StatusBadge } from "./ui";
import { GrowthChart } from "./charts";
import { useDemo } from "./store";
const desk = "/editorial-desk.jpg";
const faqs = [
  [
    "Who is NewsFlow for?",
    "Independent creators and small publishers who want a thoughtful place to publish, grow, and understand their newsletter.",
  ],
  [
    "Can I run more than one newsletter?",
    "Yes. Each publication has its own sender details, subscriber list, campaigns, and public subscription form.",
  ],
  [
    "How do people subscribe?",
    "Place your publication’s embed form on your website. Double opt-in confirms every subscriber’s consent.",
  ],
  [
    "How accurate are open and delivery metrics?",
    "Opens are estimates; delivery does not guarantee inbox placement. Email privacy features can inflate opens, and clicks may include security scanners.",
  ],
  [
    "Will this demo send real emails?",
    "No. This is an interactive prototype. Sign-in, sending, scheduling, and account actions are simulated; no email or network service is contacted.",
  ],
];
export function Landing() {
  const [faq, setFaq] = useState<number | null>(0),
    [mobile, setMobile] = useState(false);
  const { theme, setTheme } = useDemo();
  const scroll = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <div>
      <header className="border-b bg-card">
        <nav className="public-nav">
          <Link href="/" aria-label="NewsFlow home">
            <Brand />
          </Link>
          <div className="hidden items-center gap-8 text-xs text-muted-foreground md:flex">
            <button onClick={() => scroll("features")}>Features</button>
            <button onClick={() => scroll("how-it-works")}>How it works</button>
            <button onClick={() => scroll("faq")}>FAQ</button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" className="hidden sm:inline-flex" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">
                Get started
                <ArrowUpRight />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </Button>
          </div>
        </nav>
        {mobile && (
          <div className="flex justify-center gap-6 border-t p-4 text-xs">
            <button onClick={() => scroll("features")}>Features</button>
            <button onClick={() => scroll("how-it-works")}>How it works</button>
            <button onClick={() => scroll("faq")}>FAQ</button>
            <Link href="/login">Sign in</Link>
          </div>
        )}
      </header>
      <main>
        <section className="landing-hero">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />A better way
            to publish
            <ChevronRight size={12} />
          </div>
          <h1>
            Your newsletter.
            <br />A little more <span>you.</span>
          </h1>
          <p>
            Your newsletter deserves better. Publish with purpose, grow your
            audience, and understand what resonates — all in one thoughtful
            workspace.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start for free
                <ArrowRight />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => scroll("features")}
            >
              Explore the platform
            </Button>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            No credit card required. Just your next great idea.
          </p>
          <ProductPreview />
        </section>
        <div className="trust-strip">
          {[
            "Double opt-in built in",
            "One-click unsubscribe",
            "Automatic bounce suppression",
            "Honest analytics",
          ].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <ShieldCheck size={14} />
              {t}
            </span>
          ))}
        </div>
        <section className="public-section" id="features">
          <div className="eyebrow mb-4">Less friction. More connection.</div>
          <h2>
            Good ideas deserve
            <br />a great home.
          </h2>
          <div className="benefits-grid">
            {[
              {
                icon: Users,
                title: "Grow your audience",
                text: "Give readers a simple way to subscribe. Keep your audience organized, and their consent respected.",
              },
              {
                icon: FileText,
                title: "Publish with confidence",
                text: "A clean editor, thoughtful previews, and sending controls that put you in the driver’s seat.",
              },
              {
                icon: BarChart3,
                title: "Understand what works",
                text: "Clear delivery and engagement metrics. Useful insights, without the inflated promises.",
              },
            ].map((x) => (
              <div key={x.title}>
                <x.icon className="text-primary" size={23} />
                <h3>{x.title}</h3>
                <p>{x.text}</p>
              </div>
            ))}
          </div>
        </section>
        <div className="feature-band">
          <section className="public-section feature-grid">
            <div>
              <div className="eyebrow mb-4">Made for your next issue</div>
              <h2>
                A blank page.
                <br />
                Endless possibilities.
              </h2>
              <p className="my-6 max-w-md text-base leading-7 text-muted-foreground">
                Write something worth opening. Compose, preview on any screen,
                and schedule your next issue without getting lost in the tools.
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  "A focused editor that stays out of your way",
                  "Desktop and mobile email previews",
                  "Your readers. Your publications. One workspace.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check size={17} className="text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
              <Button variant="link" className="mt-5 px-0" asChild>
                <Link href="/dashboard/campaigns/new">
                  Take the editor for a spin
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3 text-xs">
                <span className="font-medium">October reflections</span>
                <StatusBadge status="Draft" />
              </div>
              <div className="px-7 py-5">
                <div className="eyebrow">Tech Insights</div>
                <h3 className="mt-4 text-2xl font-semibold">
                  A little perspective
                  <br />
                  goes a long way.
                </h3>
                <Image
                  src={desk}
                  alt="A thoughtful workspace with a laptop, coffee and plant"
                  width={1280}
                  height={768}
                  loading="lazy"
                  className="my-5 aspect-[2/1] w-full rounded object-cover"
                />
                <p className="text-xs leading-6 text-muted-foreground">
                  Ideas, tools, and stories for people building what comes next.
                </p>
                <div className="mt-4 flex justify-between border-t pt-3 text-[10px] text-muted-foreground">
                  <span>Saved · just now</span>
                  <span>Ready when you are.</span>
                </div>
              </div>
            </div>
          </section>
        </div>
        <section className="public-section feature-grid">
          <div className="surface chart-panel">
            <div className="section-title mb-1">Your audience, in focus</div>
            <p className="subtle-note mb-4">
              Subscriber growth · Illustrative demo data
            </p>
            <GrowthChart mini />
            <div className="mt-5 flex justify-between border-t pt-4 text-xs">
              <span className="text-muted-foreground">
                Steady growth. Real connections.
              </span>
              <span className="text-success">↗ 12.4%</span>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-4">Clarity over complexity</div>
            <h2>
              Numbers that tell
              <br />
              the whole story.
            </h2>
            <p className="my-6 text-base leading-7 text-muted-foreground">
              See delivery, audience growth, and estimated engagement together.
              Know what happened — and what your metrics can’t tell you.
            </p>
            <Button variant="link" className="px-0" asChild>
              <Link href="/dashboard/analytics">
                Explore analytics
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
        <section id="how-it-works" className="feature-band">
          <div className="public-section">
            <div className="eyebrow mb-4">From idea to inbox</div>
            <h2>Three steps. Your own rhythm.</h2>
            <div className="benefits-grid">
              {[
                [
                  "01",
                  "Create a publication",
                  "Choose a name, set your sender details, and make it yours.",
                ],
                [
                  "02",
                  "Bring your readers along",
                  "Add a subscription form to your site and grow with double opt-in.",
                ],
                [
                  "03",
                  "Publish. Learn. Repeat.",
                  "Compose your issue, send with care, and see what resonates.",
                ],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <span className="font-mono text-sm text-primary">{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="faq" className="public-section max-w-3xl">
          <div className="mb-9 text-center">
            <div className="eyebrow mb-3">A few good questions</div>
            <h2>Before you hit send.</h2>
          </div>
          {faqs.map(([q, a], i) => (
            <div key={q} className="border-b">
              <button
                className="flex w-full items-center justify-between gap-4 py-5 text-left font-medium"
                onClick={() => setFaq(faq === i ? null : i)}
                aria-expanded={faq === i}
              >
                {q}
                <ChevronDown
                  size={17}
                  className={faq === i ? "rotate-180" : ""}
                />
              </button>
              {faq === i && (
                <p className="pb-5 leading-7 text-muted-foreground">{a}</p>
              )}
            </div>
          ))}
        </section>
        <section className="border-y bg-accent">
          <div className="public-section text-center">
            <Sparkles size={22} className="mx-auto mb-5 text-primary" />
            <h2>Make something worth opening.</h2>
            <p className="my-5 text-muted-foreground">
              Your voice. Your audience. Your next chapter.
            </p>
            <Button size="lg" asChild>
              <Link href="/signup">
                Start your newsletter
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <div>
          <Brand />
          <p className="mt-4 text-xs text-muted-foreground">
            A thoughtful home for your newsletter.
          </p>
          <p className="mt-8 text-[10px] text-muted-foreground">
            © 2026 NewsFlow. Interactive demo.
          </p>
        </div>
        <div className="flex flex-wrap gap-10">
          {[
            ["Product", "Features", "How it works"],
            ["Resources", "Documentation", "Guides"],
            ["Company", "About", "Contact"],
            ["Legal", "Privacy", "Terms"],
          ].map(([h, ...links]) => (
            <div key={h}>
              <p className="mb-4 text-xs font-semibold">{h}</p>
              {links.map((l) => (
                <button
                  key={l}
                  className="mb-3 block text-xs text-muted-foreground"
                  onClick={() =>
                    l === "Features"
                      ? scroll("features")
                      : l === "How it works"
                        ? scroll("how-it-works")
                        : toast.info(`${l} — coming soon`)
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
export function ProductPreview() {
  return (
    <div className="hero-preview">
      <aside className="mini-sidebar">
        <div className="mb-7">
          <Brand />
        </div>
        <p className="mb-3 text-[9px] text-muted-foreground">WORKSPACE</p>
        {[
          { icon: Home, label: "Overview" },
          { icon: FileText, label: "Publications" },
          { icon: Users, label: "Subscribers" },
          { icon: Mail, label: "Campaigns" },
          { icon: BarChart3, label: "Analytics" },
        ].map((n, i) => (
          <div
            key={n.label}
            className={`mb-1 flex items-center gap-2 rounded px-2 py-2 text-[10px] ${i === 0 ? "bg-accent text-primary" : "text-muted-foreground"}`}
          >
            <n.icon size={13} />
            {n.label}
          </div>
        ))}
      </aside>
      <div className="mini-main">
        <div className="mb-5 flex justify-between">
          <div>
            <p className="text-lg font-semibold">
              Good morning, John <span className="text-primary">✳</span>
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              A fresh look at your newsletter’s story.
            </p>
          </div>
          <Button size="sm" asChild>
            <Link href="/dashboard">
              Open workspace
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
        <MetricStrip
          items={[
            {
              label: "Total subscribers",
              value: "60",
              change: "12.4%",
              good: true,
            },
            {
              label: "Campaigns sent",
              value: "6",
              change: "2 campaigns",
              good: true,
            },
            {
              label: "Delivery rate",
              value: "93.6%",
              change: "1.2%",
              good: true,
            },
            {
              label: "Bounce rate",
              value: "6.4%",
              change: "0.8% lower",
              good: true,
            },
          ]}
        />
        <div className="mt-4 grid gap-4 md:grid-cols-[1.7fr_1fr]">
          <div className="surface p-4">
            <p className="text-xs font-semibold">Subscriber growth</p>
            <GrowthChart mini />
          </div>
          <div className="surface hidden p-4 md:block">
            <p className="mb-4 text-xs font-semibold">Recent campaigns</p>
            {[
              "Small teams, meaningful work",
              "Your October reading list",
              "Five ideas for a slower Friday",
            ].map((t) => (
              <div key={t} className="border-t py-3">
                <p className="mb-1 text-[10px] font-medium">{t}</p>
                <StatusBadge status="Completed" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

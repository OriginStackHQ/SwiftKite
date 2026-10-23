"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePause,
  MailCheck,
  Menu,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  Braces,
  Lock,
  Radar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand, ProgressBar, StatusBadge, compactDeliverySegments } from "./ui";
import { useTheme } from "./theme";
import { useAuth } from "@/lib/auth";
import type { DeliveryStatus } from "@/lib/campaign-types";

const heroCounts: Record<DeliveryStatus, number> = {
  PENDING: 6,
  ATTEMPTING: 1,
  ACCEPTED: 42,
  FAILED: 2,
  DELIVERED: 118,
  BOUNCED: 1,
  COMPLAINED: 1,
  CANCELLED: 0,
};

const heroDeliveries: Array<{ id: string; email: string; status: DeliveryStatus }> = [
  { id: "d1", email: "asha@acme.test", status: "DELIVERED" },
  { id: "d2", email: "noah@northstar.test", status: "ACCEPTED" },
  { id: "d3", email: "mia@juniper.test", status: "DELIVERED" },
  { id: "d4", email: "liam@fieldwork.test", status: "PENDING" },
  { id: "d5", email: "sara@lumen.test", status: "BOUNCED" },
];

const faqs = [
  [
    "What happens if I pause a campaign?",
    "Sending stops immediately. Emails already in flight finish, and pending emails wait. Nothing resumes until you click Resume.",
  ],
  [
    "Can I edit a campaign after sending?",
    "No. A campaign is editable only while it is a Draft. After Send, the template and recipients are locked, and each email is saved as an immutable snapshot.",
  ],
  [
    "What does “Unknown outcome” mean?",
    "SwiftKite could not confirm whether the provider accepted the email. We do not retry automatically, because that could send a duplicate. A provider event may resolve it later.",
  ],
  [
    "What is the difference between Accepted and Delivered?",
    "Accepted means the provider received the message. Delivered means the provider later confirmed delivery. Accepted is not a delivery guarantee.",
  ],
  [
    "What happens if I delete a campaign?",
    "Deleting a campaign permanently removes its recipients and delivery records. Campaigns can only be deleted when Draft, Completed, or Stopped.",
  ],
];

export function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobile, setMobile] = useState(false);
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const scroll = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div>
      <header className="border-b bg-card">
        <nav className="public-nav">
          <Link href="/" aria-label="SwiftKite home">
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
            {isLoading ? (
              <div className="h-9 w-24 animate-pulse rounded-md bg-muted" aria-hidden />
            ) : isAuthenticated ? (
              <Button asChild>
                <Link href="/dashboard">
                  Dashboard
                  <ArrowUpRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" className="hidden sm:inline-flex" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">
                    Get started
                    <ArrowUpRight />
                  </Link>
                </Button>
              </>
            )}
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
            <Link href="/sign-in">Sign in</Link>
          </div>
        )}
      </header>

      <main>
        <section className="landing-hero">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Reliable email campaigns
            <ChevronRight size={12} />
          </div>
          <h1>
            Send to everyone.
            <br />
            <span>Once.</span>
          </h1>
          <p>
            Create a campaign, add recipients with their own data, and send. SwiftKite delivers
            every email individually, tracks each one, and lets you pause, resume or stop at any
            time.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Start for free
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={() => scroll("features")}>
              See how it works
            </Button>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">No credit card required</p>
          <HeroPreview />
        </section>

        <div className="trust-strip">
          {[
            "One delivery record per recipient",
            "Pause, resume or stop anytime",
            "No duplicate sends",
            "Every email tracked end to end",
          ].map((text) => (
            <span key={text} className="flex items-center gap-2">
              <ShieldCheck size={14} />
              {text}
            </span>
          ))}
        </div>

        <section className="public-section" id="features">
          <div className="eyebrow mb-4">Built for the messy middle</div>
          <h2>
            Sending is easy.
            <br />
            Sending once is the hard part.
          </h2>
          <div className="benefits-grid">
            {[
              {
                icon: Braces,
                title: "Personalize with placeholders",
                text: "Use {{name}}, {{company}} or any per-recipient key. Preview exactly what each person will receive.",
              },
              {
                icon: CirclePause,
                title: "Stay in control while sending",
                text: "Pause, resume or stop with a clear state machine. Paused campaigns never resume automatically.",
              },
              {
                icon: Radar,
                title: "See every email's status",
                text: "Accepted, delivered, failed, bounced or complained. Failure reasons are visible, never buried.",
              },
            ].map((item) => (
              <div key={item.title}>
                <item.icon className="text-primary" size={23} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="feature-band">
          <section className="public-section feature-grid">
            <div>
              <div className="eyebrow mb-4">Templates that stay honest</div>
              <h2>
                Preview the person,
                <br />
                not just the campaign.
              </h2>
              <p className="my-6 max-w-md text-base leading-7 text-muted-foreground">
                Detect placeholders as you type, insert them at the cursor, and preview against a
                real recipient. Missing values are highlighted before you send.
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  "Placeholder chips for every detected key",
                  "Desktop and mobile preview",
                  "Missing-value warnings per recipient",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check size={17} className="text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3 text-xs">
                <span className="font-medium">Message · Draft</span>
                <StatusBadge status="DRAFT" info={false} />
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-[10px] text-muted-foreground">Subject</p>
                  <p className="mt-1 text-sm font-medium">A fresh start for {"{{company}}"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["{{name}}", "{{company}}", "{{orderId}}"].map((item) => (
                    <span key={item} className="placeholder-chip">
                      {item}
                    </span>
                  ))}
                </div>
                <div className="rounded-md border bg-muted/30 p-4 text-xs leading-6">
                  <p>Hi {"{{name}}"},</p>
                  <p className="mt-2">
                    We have an update for <span className="font-medium">{"{{company}}"}</span> that
                    we think you will find useful.
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Missing: <span className="text-destructive">{"{{company}}"}</span> for 2
                    recipients
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="public-section feature-grid">
          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3 text-xs">
              <span className="font-medium">Template snapshot</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Lock size={12} />
                Locked after send
              </span>
            </div>
            <div className="space-y-3 p-6 text-xs">
              <p className="font-medium">Subject: A fresh start for Acme</p>
              <p className="leading-6 text-muted-foreground">
                Hi Asha, we have an update for Acme that we think you will find useful. Your
                reference is SK-1042.
              </p>
              <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3">
                <MailCheck size={16} className="text-success" />
                <span>Snapshot saved for this recipient</span>
              </div>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-4">Immutable by design</div>
            <h2>
              Edit the draft.
              <br />
              Never the sent email.
            </h2>
            <p className="my-6 text-base leading-7 text-muted-foreground">
              Sent emails are frozen snapshots. Changing a template later cannot rewrite history or
              change what a recipient already received.
            </p>
            <Button variant="link" className="px-0" asChild>
              <Link href="/dashboard/campaigns/new">
                Create a draft
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>

        <div className="feature-band">
          <section className="public-section feature-grid">
            <div>
              <div className="eyebrow mb-4">Stay in control</div>
              <h2>
                Stop means stop.
                <br />
                Pause means wait.
              </h2>
              <p className="my-6 max-w-md text-base leading-7 text-muted-foreground">
                Pause keeps pending emails waiting. Stop cancels what has not started and lets
                in-flight emails finish. No surprise resumes, no hidden retries.
              </p>
              <Button variant="link" className="px-0" asChild>
                <Link href="/sign-up">
                  Try the controls
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="surface p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Spring launch</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Paused by you</p>
                </div>
                <StatusBadge status="PAUSED" reason="USER" info={false} />
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                18 emails are still pending and will send when you resume.
              </p>
              <div className="mt-5 flex gap-2">
                <Button size="sm" disabled>
                  <CirclePause />
                  Resume
                </Button>
                <Button size="sm" variant="outline" disabled>
                  Stop
                </Button>
              </div>
            </div>
          </section>
        </div>

        <section className="public-section feature-grid">
          <div className="surface overflow-hidden">
            <div className="border-b px-5 py-3 text-xs font-medium">Deliveries</div>
            <div className="divide-y">
              {[
                ["asha@acme.test", "DELIVERED"],
                ["noah@northstar.test", "ACCEPTED"],
                ["mia@juniper.test", "BOUNCED"],
                ["liam@fieldwork.test", "FAILED"],
              ].map(([email, status]) => (
                <div key={email} className="flex items-center justify-between px-5 py-3 text-[11px]">
                  <span className="font-mono">{email}</span>
                  <StatusBadge status={status!} info={false} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow mb-4">Per-recipient truth</div>
            <h2>
              One delivery record.
              <br />
              Every recipient.
            </h2>
            <p className="my-6 text-base leading-7 text-muted-foreground">
              Accepted is not delivered. Unknown outcome is not failed. The details stay visible,
              with provider message IDs and the exact snapshot that was sent.
            </p>
            <Button variant="link" className="px-0" asChild>
              <Link href="/dashboard/campaigns">
                See the delivery table
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>

        <div className="feature-band">
          <section className="public-section">
            <div className="eyebrow mb-4">Provider events, handled carefully</div>
            <h2 className="mb-8">Status never moves backwards.</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["email.delivered", "Processed", "Accepted → Delivered"],
                ["email.bounced", "Processed", "Delivered stays Delivered"],
                ["email.complained", "Ignored", "Duplicate event"],
              ].map(([event, result, note]) => (
                <div key={event} className="surface p-5">
                  <p className="font-mono text-xs">{event}</p>
                  <div className="mt-3">
                    <span className={result === "Processed" ? "badge badge-success" : "badge"}>
                      {result}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section id="how-it-works" className="public-section">
          <div className="eyebrow mb-4">Three steps</div>
          <h2>Write. Add. Send.</h2>
          <div className="benefits-grid">
            {[
              ["01", "Write your template", "Subject and body with placeholders. Preview against a real recipient."],
              ["02", "Add recipients", "Paste JSON, add one at a time, and edit any row or column."],
              ["03", "Send and watch", "Pause, resume or stop while every delivery updates independently."],
            ].map(([number, title, text]) => (
              <div key={number}>
                <span className="font-mono text-sm text-primary">{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y bg-accent">
          <div className="public-section">
            <div className="eyebrow mb-4">At-most-once by design</div>
            <h2>Reliability you can explain.</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                ["Each email is sent at most once", "No automatic retry when the outcome is unclear."],
                ["Unclear outcomes are flagged", "Unknown outcome stays visible and can be repaired by a provider event."],
                ["Duplicate provider events are ignored", "The inbox deduplicates by provider event ID."],
              ].map(([title, text]) => (
                <div key={title} className="border-t pt-4">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">{text}</p>
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
          {faqs.map(([question, answer], index) => (
            <div key={question} className="border-b">
              <button
                className="flex w-full items-center justify-between gap-4 py-5 text-left font-medium"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                aria-expanded={openFaq === index}
              >
                {question}
                <ChevronDown size={17} className={openFaq === index ? "rotate-180" : ""} />
              </button>
              {openFaq === index && <p className="pb-5 leading-7 text-muted-foreground">{answer}</p>}
            </div>
          ))}
        </section>

        <section className="border-y bg-accent">
          <div className="public-section text-center">
            <Sparkles size={22} className="mx-auto mb-5 text-primary" />
            <h2>Send your next campaign once.</h2>
            <p className="my-5 text-muted-foreground">
              Track every email, keep every outcome, and stay in control.
            </p>
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Start for free
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
            Reliable email campaigns for developers and small teams.
          </p>
          <p className="mt-8 text-[10px] text-muted-foreground">© 2026 SwiftKite</p>
        </div>
        <div className="flex flex-wrap gap-10">
          <div>
            <p className="mb-4 text-xs font-semibold">Product</p>
            <button className="mb-3 block text-xs text-muted-foreground" onClick={() => scroll("features")}>
              Features
            </button>
            <button className="mb-3 block text-xs text-muted-foreground" onClick={() => scroll("how-it-works")}>
              How it works
            </button>
            <button className="mb-3 block text-xs text-muted-foreground" onClick={() => scroll("faq")}>
              FAQ
            </button>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold">Account</p>
            <Link href="/sign-in" className="mb-3 block text-xs text-muted-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="mb-3 block text-xs text-muted-foreground">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroPreview() {
  const total = Object.values(heroCounts).reduce((sum, value) => sum + value, 0);
  return (
    <div className="hero-preview" aria-hidden>
      <div className="grid w-full gap-4 p-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Spring launch</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {total} recipients · {heroCounts.DELIVERED} delivered
              </p>
            </div>
            <StatusBadge status="SENDING" info={false} />
          </div>
          <div className="mt-5">
            <ProgressBar segments={compactDeliverySegments(heroCounts)} total={total} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span>{heroCounts.DELIVERED} delivered</span>
            <span>{heroCounts.ACCEPTED} accepted</span>
            <span>{heroCounts.PENDING} pending</span>
            <span>{heroCounts.FAILED} failed</span>
          </div>
          <div className="mt-5 flex gap-2">
            <Button size="sm" variant="outline" disabled>
              <CirclePause />
              Pause
            </Button>
            <Button size="sm" variant="ghost" disabled>
              Stop
            </Button>
          </div>
        </div>
        <div className="surface overflow-hidden">
          <div className="border-b px-4 py-2 text-[10px] font-medium">Recent deliveries</div>
          <div className="divide-y">
            {heroDeliveries.map((delivery) => (
              <div key={delivery.id} className="flex items-center justify-between gap-2 px-4 py-2 text-[10px]">
                <span className="max-w-36 truncate font-mono">{delivery.email}</span>
                <StatusBadge status={delivery.status} info={false} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

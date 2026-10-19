"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Mail, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand, NewsletterPreview } from "./ui";
import { useDemo } from "./store";
import { date } from "@/data/mock";
export function SubscriberPage({
  type,
}: {
  type: "success" | "expired" | "unsubscribe" | "unsubscribed";
}) {
  const [reason, setReason] = useState("");
  const router = useRouter();
  const subscribed = type === "success",
    expired = type === "expired",
    confirmation = type === "unsubscribe";
  const { publications } = useDemo();
  const name = publications[0]?.name || "Tech Insights";
  return (
    <div className="flex min-h-screen flex-col">
      <header className="public-nav w-full">
        <Link href="/">
          <Brand />
        </Link>
        <Link href="/" className="text-xs text-muted-foreground">
          Back to NewsFlow
        </Link>
      </header>
      <main className="mx-auto my-auto w-full max-w-lg px-6 py-20 text-center">
        <div className="mx-auto mb-7 grid h-14 w-14 place-items-center rounded-full bg-accent text-primary">
          {expired ? (
            <Clock size={25} />
          ) : confirmation ? (
            <Mail size={25} />
          ) : (
            <Check size={25} />
          )}
        </div>
        <p className="eyebrow mb-4">{name}</p>
        <h1 className="text-3xl font-semibold">
          {subscribed
            ? "You’re subscribed."
            : expired
              ? "This link has expired or is invalid"
              : confirmation
                ? "A little less in your inbox?"
                : "You’re unsubscribed."}
        </h1>
        <p className="my-5 text-sm leading-7 text-muted-foreground">
          {subscribed
            ? `Welcome to ${name}. Fresh perspectives and thoughtful stories will be right at home in your inbox.`
            : expired
              ? "Confirmation links are only valid for a limited time. You can subscribe again to get a fresh start."
              : confirmation
                ? `You can unsubscribe from ${name} at any time. We respect your decision.`
                : "Your unsubscribe takes effect immediately. Thanks for being part of the conversation."}
        </p>
        {confirmation ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/unsubscribe/success");
            }}
          >
            <label
              htmlFor="reason"
              className="block text-left text-xs text-muted-foreground"
            >
              Why are you leaving? (optional)
            </label>
            <select
              className="native-select w-full"
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Choose a reason</option>
              {[
                "Too many emails",
                "Content isn’t relevant",
                "I didn’t subscribe",
                "Other",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <Button className="w-full" type="submit">
              Unsubscribe (demo)
            </Button>
            <Button className="w-full" variant="ghost" asChild>
              <Link href="/confirm/success">Keep me subscribed</Link>
            </Button>
          </form>
        ) : (
          <Button asChild>
            <Link href={`/p/${publications[0]?.id || "pub_8f3k2j"}/archive`}>
              {subscribed
                ? "Read the archive"
                : expired
                  ? "Subscribe again"
                  : "Changed your mind? Resubscribe"}
              <ArrowRight />
            </Link>
          </Button>
        )}
        <p className="mt-8 text-[10px] text-muted-foreground">
          Demo page · no real subscription is changed.
        </p>
      </main>
      <footer className="py-6 text-center text-[10px] text-muted-foreground">
        Powered by NewsFlow
      </footer>
    </div>
  );
}
export function Archive({ id }: { id: string }) {
  const { publications, campaigns } = useDemo();
  const pub = publications.find((p) => p.id === id);
  const [selected, setSelected] = useState<string | null>(null),
    [subscribed, setSubscribed] = useState(false);
  const issues = campaigns.filter(
    (c) => c.publicationId === id && c.status === "Completed",
  );
  const issue = issues.find((c) => c.id === selected);
  if (!pub)
    return (
      <div className="p-12 text-center">
        <h1 className="text-2xl font-semibold">Publication not found</h1>
        <Link href="/" className="mt-5 block text-primary">
          Back to NewsFlow
        </Link>
      </div>
    );
  return (
    <div className="min-h-screen bg-card">
      <header className="public-nav">
        <Link href="/">
          <Brand />
        </Link>
        <span className="text-xs text-muted-foreground">{pub.name}</span>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14">
        {issue ? (
          <>
            <Button
              className="mb-5"
              variant="ghost"
              onClick={() => setSelected(null)}
            >
              <ArrowLeft />
              All issues
            </Button>
            <NewsletterPreview
              subject={issue.subject}
              html={issue.content}
              publication={pub.name}
            />
          </>
        ) : (
          <>
            <p className="eyebrow mb-5">The archive</p>
            <h1 className="text-4xl font-semibold">{pub.name}</h1>
            <p className="my-5 max-w-lg text-base leading-7 text-muted-foreground">
              {pub.description}
            </p>
            <form
              className="mb-12 flex flex-wrap gap-2 border-b pb-8"
              onSubmit={(e) => {
                e.preventDefault();
                setSubscribed(true);
              }}
            >
              {subscribed ? (
                <p role="status" className="text-sm text-success">
                  Demo subscription received. No email was sent.
                </p>
              ) : (
                <>
                  <input
                    type="email"
                    required
                    aria-label="Subscribe email"
                    placeholder="you@example.com"
                    className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                  />
                  <Button type="submit">
                    Subscribe (demo)
                    <ArrowRight />
                  </Button>
                </>
              )}
            </form>
            {issues.length ? (
              issues.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className="block w-full border-b py-7 text-left"
                >
                  <p className="mb-2 text-xs text-muted-foreground">
                    {date(c.date)}
                  </p>
                  <h2 className="text-xl font-semibold">
                    {c.subject}
                    <ArrowRight className="float-right" size={18} />
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {c.preview}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-muted-foreground">
                The first issue is on its way. Subscribe to be part of it.
              </p>
            )}
          </>
        )}
      </main>
      <footer className="public-footer text-xs text-muted-foreground">
        <span>© 2026 {pub.name}</span>
        <Link href="/">Published with NewsFlow</Link>
      </footer>
    </div>
  );
}

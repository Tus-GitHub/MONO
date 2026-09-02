import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Icon, type IconName } from "@/components/ui/icon";
import { requireOnboarded } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Privacy" };

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "lock",
    title: "Private to the two of you",
    body: "Everything in your MONO space — dates, photos, memories, reviews, spending — is visible only to you and your partner. No one else at MONO reads it, and it is never shown to other users.",
  },
  {
    icon: "user",
    title: "We ask for very little",
    body: "An email and a password to sign in, and whatever name, nickname or photo you choose to add. Nothing more is required, and there is no tracking or advertising.",
  },
  {
    icon: "eyeOff",
    title: "No public profiles",
    body: "MONO does not create a public page for you or your couple. There is nothing to discover, follow, or search. The whole app is set to no-index for search engines.",
  },
  {
    icon: "star",
    title: "Reviews stay between you",
    body: "Your reviews and scores are part of your shared history. They are never published, aggregated across couples, or attached to a place other people can see.",
  },
  {
    icon: "images",
    title: "Photos are not on the open web",
    body: "Every image is served through an authenticated, per-request check and marked no-index. A photo's link is not guessable and only an active member of your couple can open it.",
  },
  {
    icon: "trash",
    title: "You can leave, and take your data",
    body: "Export everything as a file at any time. Disconnecting or deleting archives the shared space rather than shredding it, so an accident can be undone — permanent deletion is available on request.",
  },
];

export default async function PrivacyPage() {
  await requireOnboarded();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Your privacy"
        description="What MONO does — and deliberately doesn't do — with what you put here."
        back={{ href: "/settings", label: "Settings" }}
      />

      <p className="rounded-xl border border-primary/25 bg-primary-tint/40 px-4 py-3 text-sm font-medium text-ink">
        Your MONO space is private to the two of you.
      </p>

      <ul className="space-y-3">
        {POINTS.map((point) => (
          <li key={point.title} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
              <Icon name={point.icon} size="sm" />
            </span>
            <div>
              <p className="text-sm font-medium text-ink">{point.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{point.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted">
        Manage your own privacy toggles — hiding money figures, hiding the per-person preference
        breakdown — in{" "}
        <Link href="/settings" className="text-primary hover:underline">
          Settings → Preferences
        </Link>
        .
      </p>
    </div>
  );
}

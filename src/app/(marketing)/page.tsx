import type { ReactNode } from "react";

import { Logo, MonoMark } from "@/components/layout/logo";
import { Icon, type IconName } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/link-button";
import { getCurrentUser } from "@/lib/auth";

const CHAPTERS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "calendarPlus",
    title: "Plan it",
    body: "Draft an idea, set a place and a budget, and shape the evening together before it happens.",
  },
  {
    icon: "camera",
    title: "Live it",
    body: "On the day, capture what actually happened — the photos, the spending, the detours.",
  },
  {
    icon: "sparkles",
    title: "Keep it",
    body: "Rate it between the two of you, decide if it's worth a return, and keep the memory.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh w-full max-w-full flex-col overflow-x-clip">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <LinkButton href="/home" size="sm">
              Open MONO
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/login" size="sm" variant="ghost">
                Sign in
              </LinkButton>
              <LinkButton href="/register" size="sm">
                Get started
              </LinkButton>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl min-w-0 flex-1 px-5">
        <section className="grid grid-cols-1 gap-10 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
              <span className="size-1.5 rounded-full bg-primary" />
              For two people. No one else.
            </p>
            <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
              A private record of{" "}
              <span className="italic text-primary">your</span> time together.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
              MONO is a relationship journal, a date planner, and a memory archive — kept by the
              two of you and no one else.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/register" size="lg" trailingIcon={<Icon name="arrowRight" size="sm" />}>
                Create your space
              </LinkButton>
              <LinkButton href="/login" size="lg" variant="secondary">
                I already have one
              </LinkButton>
            </div>
          </div>

          <div className="relative mx-auto hidden aspect-square w-full max-w-sm place-items-center rounded-2xl border border-line bg-surface shadow-sm lg:grid">
            <MonoMark className="h-28 w-28 text-ink" />
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-primary-tint/60 via-transparent to-accent-tint/50" />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 pb-20 sm:grid-cols-3">
          {CHAPTERS.map((chapter) => (
            <Chapter key={chapter.title} {...chapter} />
          ))}
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-faint">
        MONO is invite-only. Every space holds exactly two people.
      </footer>
    </div>
  );
}

function Chapter({ icon, title, body }: { icon: IconName; title: string; body: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <span className="grid size-9 place-items-center rounded-lg bg-primary-tint text-primary">
        <Icon name={icon} size="sm" />
      </span>
      <h2 className="mt-3 font-display text-lg font-medium text-ink">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

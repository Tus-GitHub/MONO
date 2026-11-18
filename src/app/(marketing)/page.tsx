import type { ReactNode } from "react";

import { Logo, AmorMark } from "@/components/layout/logo";
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
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <LinkButton href="/home" size="sm">
              Open AMOR
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

      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 sm:px-6">
        <section className="relative grid grid-cols-1 gap-10 py-10 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 top-0 size-72 rounded-full bg-primary-tint/45 blur-3xl motion-safe:anim-drift"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 bottom-6 size-72 rounded-full bg-accent-tint/40 blur-3xl motion-safe:anim-drift"
            style={{ animationDelay: "-6s" }}
          />

          <div className="relative z-10">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-xs">
              <span className="size-1.5 rounded-full bg-primary" />
              For two people. No one else.
            </p>
            <h1 className="font-display text-3xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
              A private record of{" "}
              <span className="italic text-primary">your</span> time together.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted sm:mt-5 sm:text-lg">
              AMOR is a relationship journal, a date planner, and a memory archive — plan
              multi-stop dates, keep private encrypted conversations, and turn evenings into lasting
              memories.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <LinkButton href="/register" size="lg" trailingIcon={<Icon name="arrowRight" size="sm" />}>
                Create your space
              </LinkButton>
              <LinkButton href="/login" size="lg" variant="secondary">
                I already have one
              </LinkButton>
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-md lg:max-w-none">
            <HeroPreview />
          </div>
        </section>

        <section className="relative z-10 grid grid-cols-1 gap-4 pb-16 sm:grid-cols-3 sm:pb-20">
          {CHAPTERS.map((chapter) => (
            <Chapter key={chapter.title} {...chapter} />
          ))}
        </section>
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-faint">
        AMOR is invite-only. Every space holds exactly two people.
      </footer>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative rounded-2xl border border-line bg-surface p-4 shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <AmorMark className="h-6 w-14 text-ink" />
          <div>
            <p className="text-2xs font-medium uppercase tracking-wider text-muted">Example date</p>
            <p className="font-display text-base font-medium text-ink">Café &amp; movie</p>
          </div>
        </div>
        <span className="rounded-full bg-primary-tint px-2.5 py-1 text-2xs font-semibold text-primary">
          4:00 – 8:00 PM
        </span>
      </div>

      <div className="mt-3.5 space-y-2.5">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper/70 px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-tint text-primary">
            <Icon name="coffee" size="sm" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">Corner Roastery</p>
            <p className="text-xs text-muted">4:00 – 5:00 PM · Coffee &amp; catch-up</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper/70 px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-tint text-accent">
            <Icon name="film" size="sm" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">Evening Cinema</p>
            <p className="text-xs text-muted">5:30 – 8:00 PM · Second stop</p>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-elevated px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Icon name="lock" size="xs" className="text-success" />
          End-to-end encrypted chat
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-rating">
          <Icon name="star" size="xs" />
          Blind reviews
        </span>
      </div>
    </div>
  );
}

function Chapter({ icon, title, body }: { icon: IconName; title: string; body: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-xs transition-[transform,box-shadow,border-color] duration-fast ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm">
      <span className="grid size-9 place-items-center rounded-lg bg-primary-tint text-primary">
        <Icon name={icon} size="sm" />
      </span>
      <h2 className="mt-3 font-display text-lg font-medium text-ink">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

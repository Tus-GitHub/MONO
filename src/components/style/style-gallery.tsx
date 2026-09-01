"use client";

import { useState, type ReactNode } from "react";
import { DateStatus } from "@prisma/client";

import { Logo, MonoMark } from "@/components/layout/logo";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DateStatusBadge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CoupleAvatar } from "@/components/ui/couple-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ImageCard } from "@/components/ui/image-card";
import { Input, InputGroup, Textarea } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Modal } from "@/components/ui/modal";
import { Rating } from "@/components/ui/rating";
import { SearchInput } from "@/components/ui/search";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StickyBar } from "@/components/ui/sticky-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

const DEMO_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='360'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#b45a41'/><stop offset='1' stop-color='#6c4664'/></linearGradient></defs><rect width='480' height='360' fill='url(#g)'/><circle cx='150' cy='150' r='70' fill='none' stroke='#f5f1ea' stroke-width='6'/><circle cx='210' cy='150' r='70' fill='#f5f1ea' opacity='0.85'/></svg>`,
  );

const COLOR_TOKENS: { name: string; className: string; border?: boolean }[] = [
  { name: "paper", className: "bg-paper", border: true },
  { name: "surface", className: "bg-surface", border: true },
  { name: "elevated", className: "bg-elevated", border: true },
  { name: "ink", className: "bg-ink" },
  { name: "muted", className: "bg-muted" },
  { name: "faint", className: "bg-faint" },
  { name: "line", className: "bg-line" },
  { name: "primary", className: "bg-primary" },
  { name: "primary-tint", className: "bg-primary-tint" },
  { name: "accent", className: "bg-accent" },
  { name: "accent-tint", className: "bg-accent-tint" },
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
  { name: "error", className: "bg-error" },
  { name: "rating", className: "bg-rating" },
];

function Section({
  title,
  spec,
  children,
}: {
  title: string;
  spec: string;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-20 border-t border-line py-10 first:border-t-0">
      <div className="mb-5">
        <h2 className="font-display text-xl font-medium text-ink">{title}</h2>
        <p className="mt-1 text-sm text-muted">{spec}</p>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-start sm:gap-4">
      <span className="pt-1.5 text-2xs font-medium uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function StyleGallery() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chips, setChips] = useState<string[]>(["Dinner"]);
  const [rating, setRating] = useState(3);

  const toggleChip = (value: string) =>
    setChips((current) =>
      current.includes(value) ? current.filter((c) => c !== value) : [...current, value],
    );

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-paper/85 px-4 backdrop-blur-md sm:px-6">
        <Logo href="/" />
        <span className="text-2xs font-medium uppercase tracking-wide text-faint">
          Style · dev only
        </span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6">
        <Section title="1 · Brand" spec="Fraunces wordmark, wide tracking. The mark: a ring + a clay disc, overlapping — two as one. No hearts.">
          <Row label="Lockup">
            <Logo variant="lockup" size="lg" href={null} />
            <Logo variant="lockup" size="md" href={null} />
            <Logo variant="lockup" size="sm" href={null} />
          </Row>
          <Row label="Mark / word">
            <MonoMark className="h-10 w-10 text-ink" />
            <Logo variant="wordmark" href={null} />
          </Row>
        </Section>

        <Section title="2 · Colour tokens" spec="Semantic only. Warm near-monochrome + one clay primary + plum accent + honey ratings. Auto light/dark.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_TOKENS.map((token) => (
              <div key={token.name} className="overflow-hidden rounded-lg border border-line">
                <div className={`h-14 ${token.className}`} />
                <div className="bg-surface px-2 py-1.5 font-mono text-2xs text-muted">
                  {token.name}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography" spec="Fraunces (display) + Inter (UI). h1–h4 default to display, weight 500.">
          <h1 className="font-display text-4xl text-ink">A private record</h1>
          <h3 className="font-display text-xl text-ink">Section heading</h3>
          <p className="max-w-prose text-ink">
            Body copy in Inter. The two of you, on the record — plans, photos, spending, and the
            small verdicts you reach together.
          </p>
          <p className="text-sm text-muted">Muted supporting text, 14px.</p>
        </Section>

        <Section title="3 · Buttons" spec="Variants × sizes. Every one: hover / focus-visible / active / disabled / loading.">
          <Row label="Variants">
            <Button variant="primary">Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="Sizes">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add">
              <Icon name="plus" size="sm" />
            </Button>
          </Row>
          <Row label="States">
            <Button leadingIcon={<Icon name="calendarPlus" size="sm" />}>With icon</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <LinkButton href="/" variant="secondary" trailingIcon={<Icon name="arrowRight" size="sm" />}>
              LinkButton
            </LinkButton>
          </Row>
        </Section>

        <Section title="3 · Inputs, select, search" spec="Shared 44px control height, one focus ring, invalid + disabled states.">
          <Row label="Text">
            <Input placeholder="Default input" className="max-w-xs" />
            <Input placeholder="Invalid" invalid className="max-w-xs" />
            <Input placeholder="Disabled" disabled className="max-w-xs" />
          </Row>
          <Row label="Select">
            <Select defaultValue="" className="max-w-xs">
              <option value="" disabled>
                Choose a category
              </option>
              <option>Dinner</option>
              <option>Walk</option>
              <option>Cinema</option>
            </Select>
          </Row>
          <Row label="Search">
            <SearchInput placeholder="Search places" className="max-w-xs" />
          </Row>
          <Row label="Group">
            <InputGroup className="max-w-xs" leading={<Icon name="mapPin" size="sm" />}>
              <input
                className="h-11 w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
                placeholder="Location"
              />
            </InputGroup>
          </Row>
          <Row label="Field">
            <Field
              label="Notes"
              htmlFor="demo-notes"
              errors={["Keep it under 200 characters."]}
              className="max-w-xs"
            >
              <Textarea id="demo-notes" invalid placeholder="What made it good?" />
            </Field>
          </Row>
        </Section>

        <Section title="3 · Cards & image cards" spec="Photography-first. Images always object-cover with a legibility scrim.">
          <Card interactive>
            <CardHeader
              icon={<Icon name="calendar" size="sm" />}
              title="Interactive card"
              description="Hover to lift."
              action={<Badge tone="primary">New</Badge>}
            />
            <CardBody>Card body content sits here in ink at 14px.</CardBody>
            <CardFooter>
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm">Primary</Button>
            </CardFooter>
          </Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ImageCard
              src={DEMO_PHOTO}
              alt="Demo"
              unoptimized
              aspect="4/3"
              caption="Rooftop, first frost"
              topRight={<Badge tone="neutral">3 photos</Badge>}
            />
            <ImageCard src={DEMO_PHOTO} alt="Demo" unoptimized aspect="square" />
            <ImageCard src={DEMO_PHOTO} alt="Demo" unoptimized aspect="portrait" />
          </div>
        </Section>

        <Section title="3 · Rating" spec="Keyboard: arrows adjust, Home/End jump. Star or heart. Pop on select (motion-safe).">
          <Row label="Interactive">
            <Rating value={rating} onChange={setRating} />
            <span className="text-sm text-muted">{rating} / 5</span>
          </Row>
          <Row label="Hearts / read-only">
            <Rating glyph="heart" defaultValue={4} size="lg" />
            <Rating value={5} readOnly size="sm" />
          </Row>
        </Section>

        <Section title="3 · Avatars & couple avatars" spec="Initials fallback with a deterministic tint. Couple = two overlapping / a dashed placeholder.">
          <Row label="Avatar">
            <Avatar name="Rae Kim" size="xs" />
            <Avatar name="Rae Kim" size="sm" />
            <Avatar name="Jordan Vega" size="md" />
            <Avatar name="Sam" size="lg" />
          </Row>
          <Row label="Couple">
            <CoupleAvatar members={[{ name: "Rae Kim" }, { name: "Jordan Vega" }]} size="md" />
            <CoupleAvatar members={[{ name: "Rae Kim" }]} size="md" />
          </Row>
        </Section>

        <Section title="3 · Chips, badges" spec="Chips select/remove; badges label status. Date lifecycle has its own badge.">
          <Row label="Chips">
            {["Dinner", "Walk", "Cinema", "At home"].map((value) => (
              <Chip key={value} selected={chips.includes(value)} onClick={() => toggleChip(value)}>
                {value}
              </Chip>
            ))}
            <Chip onRemove={() => undefined}>Removable</Chip>
          </Row>
          <Row label="Badges">
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="primary" dot>
              Primary
            </Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="error">Error</Badge>
          </Row>
          <Row label="Date status">
            {Object.values(DateStatus).map((status) => (
              <DateStatusBadge key={status} status={status} />
            ))}
          </Row>
        </Section>

        <Section title="3 · Tabs" spec="Roving focus, arrow keys, sliding underline (transition respects reduced motion).">
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming">
              <p className="text-sm text-muted">Upcoming dates would list here.</p>
            </TabsContent>
            <TabsContent value="past">
              <p className="text-sm text-muted">Past dates would list here.</p>
            </TabsContent>
            <TabsContent value="drafts">
              <p className="text-sm text-muted">Draft ideas would list here.</p>
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="3 · Overlays & feedback" spec="Modal (scale-in), bottom sheet (drag-to-dismiss), toasts, confirm dialog. Focus-trapped, ESC, scroll-locked.">
          <Row label="Triggers">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open bottom sheet
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast({ title: "Saved", description: "Your plan was updated.", variant: "success" })}
            >
              Success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast({ title: "Couldn't save", variant: "error" })}
            >
              Error toast
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete this date?",
                  description: "This can't be undone.",
                  confirmLabel: "Delete",
                  tone: "danger",
                });
                toast({ title: ok ? "Deleted" : "Kept", variant: ok ? "success" : "default" });
              }}
            >
              Confirm dialog
            </Button>
          </Row>
          <Row label="Alerts">
            <div className="w-full max-w-md space-y-2">
              <Alert tone="info" title="Heads up">Informational message.</Alert>
              <Alert tone="success">Everything went through.</Alert>
              <Alert tone="warning">Double-check the date and time.</Alert>
              <Alert tone="error">That didn&apos;t work.</Alert>
            </div>
          </Row>
        </Section>

        <Section title="3 · Loading, skeletons, empty & error" spec="Shimmer stops under reduced motion.">
          <Row label="Spinner">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </Row>
          <Row label="Skeleton">
            <div className="w-full max-w-md space-y-4">
              <SkeletonText lines={3} />
              <SkeletonCard />
              <Skeleton className="aspect-[3/1]" />
            </div>
          </Row>
          <EmptyState
            icon={<Icon name="images" size="md" />}
            title="Nothing here yet"
            description="Empty states are calm and encouraging — never an error."
            action={<Button size="sm">Add the first</Button>}
          />
          <ErrorState onRetry={() => toast({ title: "Retrying…" })} />
        </Section>

        <Section title="5 · Sticky actions" spec="Pins above the mobile nav with a frosted background and safe-area padding.">
          <div className="relative h-40 overflow-hidden rounded-xl border border-line">
            <div className="scroll-area h-full p-4 text-sm text-muted">
              Scroll region. The bar below stays put.
              <div className="h-40" />
              End of region.
              <StickyBar>
                <Button variant="ghost" fullWidth>
                  Cancel
                </Button>
                <Button fullWidth>Save changes</Button>
              </StickyBar>
            </div>
          </div>
        </Section>

        <Section title="6 · Motion" spec="anim-fade / rise / scale-in / sheet-in / pop + skeleton shimmer. Page transitions via (app)/template.tsx. Global prefers-reduced-motion damper.">
          <p className="text-sm text-muted">
            Open the overlays above to see scale-in / sheet-in. The rating pops on select. Turn on
            &ldquo;reduce motion&rdquo; in your OS and every animation and transition drops to
            near-zero — one global rule.
          </p>
        </Section>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal"
        description="Focus-trapped, ESC to close, backdrop click to dismiss."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModalOpen(false)}>Got it</Button>
          </>
        }
      >
        <p>Any content goes here. It scrolls if it gets tall.</p>
      </Modal>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Bottom sheet"
        description="Drag the handle down to dismiss."
        footer={
          <Button fullWidth onClick={() => setSheetOpen(false)}>
            Done
          </Button>
        }
      >
        <p className="text-sm text-muted">
          The mobile-first modal. Rises from the bottom edge, respects the safe area.
        </p>
      </BottomSheet>
    </div>
  );
}

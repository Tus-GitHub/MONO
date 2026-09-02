import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import { formatDate } from "@/lib/utils/format";
import type { CoupleProfile } from "@/server/services/couple-insights-service";

function togetherFor(iso: string | null): string | null {
  if (!iso) return null;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return "just started";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const y = years > 0 ? `${years} ${years === 1 ? "year" : "years"}` : "";
  const m = rem > 0 ? `${rem} ${rem === 1 ? "month" : "months"}` : "";
  return [y, m].filter(Boolean).join(", ");
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export function CoupleProfileHeader({ profile }: { profile: CoupleProfile }) {
  const { couple, members, statistics } = profile;
  const together = togetherFor(couple.anniversaryAt);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="relative aspect-[5/2] w-full bg-line">
        {couple.photoUrl ? (
          <Photo
            displayUrl={couple.photoUrl}
            thumbUrl={couple.photoUrl}
            alt=""
            priority
            aspect="5 / 2"
            sizes="(min-width: 768px) 44rem, 100vw"
            className="absolute inset-0"
          />
        ) : (
          <div className="grid size-full place-items-center bg-linear-to-br from-primary-tint via-surface to-accent-tint">
            <Icon name="heartHandshake" size={40} className="text-primary/50" />
          </div>
        )}
      </div>

      <div className="p-5">
        <h1 className="font-display text-2xl font-medium text-ink">
          {couple.name ?? "Your space"}
        </h1>
        {couple.description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">{couple.description}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-2">
              <Avatar name={member.name} src={member.avatarUrl} size="sm" />
              <div className="leading-tight">
                <p className="text-sm font-medium text-ink">
                  {member.name}
                  {member.isViewer ? <span className="text-faint"> · you</span> : null}
                </p>
                {member.pronouns ? (
                  <p className="text-2xs text-faint">{member.pronouns}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {(couple.anniversaryAt || together) && (
          <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
            <Icon name="calendar" size="sm" className="text-faint" />
            {couple.anniversaryAt ? (
              <>
                Together since {formatDate(couple.anniversaryAt, "long")}
                {together ? <span className="text-faint"> · {together}</span> : null}
              </>
            ) : null}
          </p>
        )}

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
          <Figure value={statistics.totalDates} label="dates" />
          <Figure value={statistics.placesVisited} label="places visited" />
          <Figure value={statistics.memoriesKept} label="memories" />
        </dl>
      </div>
    </section>
  );
}

import { Icon } from "@/components/ui/icon";
import { scorePercent } from "@/lib/review/scale";
import type { CategoryPreference, PreferenceGap } from "@/lib/couple/insights";
import type {
  CoupleProfile,
  CoupleProfileMember,
} from "@/server/services/couple-insights-service";

function MemberDot({
  member,
  avg,
}: {
  member: CoupleProfileMember;
  avg: number;
}) {
  return (
    <span
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${scorePercent(avg)}%` }}
      title={`${member.nickname || member.name}: ${avg.toFixed(1)}`}
    >
      <span
        className={
          member.isViewer
            ? "block size-2.5 rounded-full border-2 border-surface bg-primary"
            : "block size-2.5 rounded-full border-2 border-surface bg-accent"
        }
      />
    </span>
  );
}

function CategoryRow({
  pref,
  members,
  showPerMember,
}: {
  pref: CategoryPreference;
  members: CoupleProfileMember[];
  showPerMember: boolean;
}) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink">{pref.label}</span>
        <span className="font-display text-sm font-semibold tabular-nums text-ink">
          {pref.coupleAvg?.toFixed(1)}
          <span className="text-xs font-normal text-faint">/10</span>
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-rating-track">
        <div
          className="h-full rounded-full bg-rating"
          style={{ width: `${scorePercent(pref.coupleAvg)}%` }}
        />
        {showPerMember
          ? pref.perMember.map((pm) => {
              const member = members.find((m) => m.id === pm.memberId);
              return member && pm.avg != null ? (
                <MemberDot key={pm.memberId} member={member} avg={pm.avg} />
              ) : null;
            })
          : null}
      </div>
    </li>
  );
}

export function CategoryPreferences({ profile }: { profile: CoupleProfile }) {
  const shown = profile.categoryPreferences.filter((p) => p.coupleAvg != null);
  const { members, preferenceBreakdownVisible, preferenceGaps } = profile;
  const partner = members.find((m) => !m.isViewer);

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-medium text-ink">How you rate the details</h2>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-sm text-muted">
          Rate a few dates together and your shared preferences will build here.
        </p>
      ) : (
        <div className="rounded-xl border border-line bg-surface p-4">
          {preferenceBreakdownVisible && partner ? (
            <div className="mb-3 flex items-center gap-4 border-b border-line pb-3 text-2xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rating" /> together
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" /> you
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent" /> {partner.nickname || partner.name}
              </span>
            </div>
          ) : null}
          <ul className="divide-y divide-line">
            {shown.map((pref) => (
              <CategoryRow
                key={pref.key}
                pref={pref}
                members={members}
                showPerMember={preferenceBreakdownVisible}
              />
            ))}
          </ul>
        </div>
      )}

      {preferenceBreakdownVisible && preferenceGaps.length > 0 ? (
        <Differences gaps={preferenceGaps} />
      ) : null}
    </section>
  );
}

function Differences({ gaps }: { gaps: PreferenceGap[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Where your tastes differ</p>
      <ul className="mt-2.5 space-y-2">
        {gaps.map((gap) => (
          <li key={gap.categoryKey} className="flex items-start gap-2 text-sm text-muted">
            <Icon name="info" size="sm" className="mt-0.5 shrink-0 text-faint" />
            {gap.phrase}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-2xs text-faint">
        Different tastes, not a problem — it just tells you what to lean into when you plan.
      </p>
    </div>
  );
}

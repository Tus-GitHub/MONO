import Link from "next/link";

import { MatchBadge } from "@/components/explore/match-badge";
import { RecFeedback } from "@/components/explore/rec-feedback";
import { Icon } from "@/components/ui/icon";
import type { RecommendedIdea } from "@/server/services/explore-service";

export function IdeaCard({ idea }: { idea: RecommendedIdea }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-tint text-accent">
          <Icon name={idea.icon} size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">{idea.title}</p>
            <MatchBadge match={idea.match} />
          </div>
          <p className="mt-0.5 text-xs text-muted">{idea.blurb}</p>
        </div>
      </div>

      <p className="text-xs text-muted">{idea.match.reason}</p>

      <div className="mt-auto space-y-2">
        <RecFeedback
          targetType="IDEA"
          targetKey={idea.key}
          initial={idea.feedback}
          choices={["INTERESTED", "SAVED", "NOT_FOR_US"]}
        />
        <Link
          href={`/plan?idea=${encodeURIComponent(idea.title)}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Plan this
          <Icon name="arrowRight" size={13} />
        </Link>
      </div>
    </article>
  );
}

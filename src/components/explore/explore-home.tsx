import { IdeaCard } from "@/components/explore/idea-card";
import { RecommendationCard } from "@/components/explore/recommendation-card";
import { Icon } from "@/components/ui/icon";
import type { ExploreHome as ExploreHomeData, ExploreSection } from "@/server/services/explore-service";

function Section({ section }: { section: ExploreSection }) {
  const ideaOnly = section.places.length === 0;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-medium text-ink">{section.title}</h2>
        {section.subtitle ? <p className="text-sm text-muted">{section.subtitle}</p> : null}
      </div>

      {section.places.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {section.places.map((place) => (
            <RecommendationCard key={place.placeId} place={place} />
          ))}
        </div>
      ) : null}

      {section.ideas.length > 0 ? (
        <div className={ideaOnly ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
          {section.ideas.map((idea) => (
            <IdeaCard key={idea.key} idea={idea} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ExploreHome({ data }: { data: ExploreHomeData }) {
  return (
    <div className="space-y-10">
      {!data.hasHistory ? (
        <p className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-muted">
          <Icon name="info" size="sm" className="mt-0.5 shrink-0 text-faint" />
          These are starting points. As you finish and rate more dates, the recommendations and
          match scores sharpen to the two of you.
        </p>
      ) : null}

      {data.savedIdeas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink">Saved for later</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.savedIdeas.map((idea) => (
              <IdeaCard key={idea.key} idea={idea} />
            ))}
          </div>
        </section>
      ) : null}

      {data.sections.map((section) => (
        <Section key={section.key} section={section} />
      ))}
    </div>
  );
}

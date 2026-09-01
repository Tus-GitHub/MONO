/**
 * Plan vs Reality — pure diffing for the memory/story comparison. Given what was planned and
 * what the couple recorded actually happened, work out what held, what changed, and what was
 * a surprise. No framing here; the component decides how warmly to tell it.
 */

export interface ComparisonInput {
  plannedTime: string | null;
  actualTime: string | null;
  plannedPlace: string | null;
  actualPlace: string | null;
  plannedBudgetCents: number | null;
  actualSpendCents: number | null;
  plannedActivities: string[];
  actualActivities: string[];
  /** ACTUAL activities the couple flagged as unplanned detours / extra stops. */
  extraActivities: string[];
}

export interface FieldDiff<T> {
  planned: T;
  actual: T;
  changed: boolean;
}

export interface ActivityDiff {
  recorded: boolean;
  planned: string[];
  actual: string[];
  kept: string[];
  dropped: string[];
  added: string[];
}

export type Divergence = "as-planned" | "adjusted" | "improvised";

export interface Comparison {
  time: FieldDiff<string | null>;
  place: FieldDiff<string | null>;
  budget: FieldDiff<number | null> & { deltaCents: number | null };
  activities: ActivityDiff;
  extras: string[];
  divergence: Divergence;
  /** How many of the compared dimensions moved. */
  changeCount: number;
}

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** Only a real divergence — we never call a not-yet-recorded field "changed". */
function differ(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return false;
  return norm(a) !== norm(b);
}

export function buildComparison(input: ComparisonInput): Comparison {
  const activitiesRecorded =
    input.actualActivities.length > 0 || input.extraActivities.length > 0;

  const plannedSet = new Map(input.plannedActivities.map((t) => [norm(t), t] as const));
  const actualSet = new Map(input.actualActivities.map((t) => [norm(t), t] as const));

  const kept: string[] = [];
  const dropped: string[] = [];
  const added: string[] = [];
  if (activitiesRecorded) {
    for (const [key, title] of plannedSet) {
      if (actualSet.has(key)) kept.push(title);
      else dropped.push(title);
    }
    for (const [key, title] of actualSet) {
      if (!plannedSet.has(key)) added.push(title);
    }
  }

  const timeChanged = differ(input.plannedTime, input.actualTime);
  const placeChanged = differ(input.plannedPlace, input.actualPlace);

  const deltaCents =
    input.plannedBudgetCents != null && input.actualSpendCents != null
      ? input.actualSpendCents - input.plannedBudgetCents
      : null;
  // "changed" only when we can actually compare and it moved by more than a rounding nudge.
  const budgetChanged = deltaCents != null && Math.abs(deltaCents) >= 100;

  const activitiesChanged = dropped.length > 0 || added.length > 0;
  const changeCount =
    (timeChanged ? 1 : 0) +
    (placeChanged ? 1 : 0) +
    (budgetChanged ? 1 : 0) +
    (activitiesChanged ? 1 : 0) +
    (input.extraActivities.length > 0 ? 1 : 0);

  const divergence: Divergence =
    changeCount === 0 ? "as-planned" : changeCount <= 2 ? "adjusted" : "improvised";

  return {
    time: { planned: input.plannedTime, actual: input.actualTime, changed: timeChanged },
    place: { planned: input.plannedPlace, actual: input.actualPlace, changed: placeChanged },
    budget: {
      planned: input.plannedBudgetCents,
      actual: input.actualSpendCents,
      changed: budgetChanged,
      deltaCents,
    },
    activities: {
      recorded: activitiesRecorded,
      planned: input.plannedActivities,
      actual: input.actualActivities,
      kept,
      dropped,
      added,
    },
    extras: input.extraActivities,
    divergence,
    changeCount,
  };
}

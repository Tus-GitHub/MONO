import { Icon } from "@/components/ui/icon";
import type { ValueForMoney } from "@/lib/date/value-for-money";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const TONE: Record<Exclude<ValueForMoney["tier"], "unknown">, string> = {
  great: "border-success/25 bg-success-tint/50 text-success",
  fair: "border-line bg-surface text-muted",
  steep: "border-warning/25 bg-warning-tint/50 text-warning",
};

/** Ties the recorded spend to the review's "Value for money" score. Nothing else is inferred. */
export function ValueForMoneyCard({
  vfm,
  currency,
}: {
  vfm: ValueForMoney;
  currency: string;
}) {
  if (vfm.tier === "unknown") return null;

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-4 shadow-sm", TONE[vfm.tier])}>
      <Icon name="wallet" size="sm" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Value for money</p>
        <p className="mt-0.5 text-sm text-ink/90">{vfm.line}</p>
        <p className="mt-1 text-xs text-muted">
          {vfm.spendCents != null ? formatMoney(vfm.spendCents, currency) : "spend not recorded"}
          {vfm.valueScore != null ? ` · you both rated the value ${vfm.valueScore.toFixed(1)}/10` : ""}
        </p>
      </div>
    </div>
  );
}

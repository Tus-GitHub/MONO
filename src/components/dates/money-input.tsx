import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export function centsToInput(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toString();
}

/** `$`-prefixed decimal money field, matching the plan flow's input. */
export function MoneyInput({
  id,
  name,
  defaultValue,
  placeholder = "0",
  invalid,
  className,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">
        $
      </span>
      <Input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        defaultValue={defaultValue}
        placeholder={placeholder}
        invalid={invalid}
        className="pl-7"
      />
    </div>
  );
}

import { passwordStrength } from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils/cn";

export function PasswordStrength({ value, id }: { value: string; id: string }) {
  const strength = passwordStrength(value);
  const tone = strength.level >= 3 ? "text-success" : strength.level === 2 ? "text-warning" : "text-error";
  const bar = strength.level >= 3 ? "bg-success" : strength.level === 2 ? "bg-warning" : "bg-error";
  return (
    <div id={id} className="space-y-2 text-xs">
      <p aria-live="polite" className={cn("font-medium", value ? tone : "text-muted")}>
        {value ? `Password strength: ${strength.label}` : "Use at least 6 characters."}
      </p>
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => <span key={segment} className={cn("h-1 flex-1 rounded-full", segment <= strength.level ? bar : "bg-line")} />)}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-faint" aria-label="Password strength guidance">
        {strength.checks.map((check) => <li key={check.label} className={check.met ? "text-success" : undefined}>
          <span aria-hidden="true">{check.met ? "✓ " : "○ "}</span>{check.label}<span className="sr-only">{check.met ? ": included" : ": not included"}</span>
        </li>)}
      </ul>
      <p className="text-faint">Mix character types for a stronger password.</p>
    </div>
  );
}

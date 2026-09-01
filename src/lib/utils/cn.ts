export type ClassValue =
  | string
  | number
  | bigint
  | null
  | false
  | undefined
  | ClassValue[];

/**
 * Minimal className joiner. Intentionally dependency-free — MONO does not pull in
 * `clsx` / `tailwind-merge`. Falsy values are dropped; arrays are flattened.
 */
export function cn(...inputs: ClassValue[]): string {
  const parts: string[] = [];

  const walk = (value: ClassValue): void => {
    if (value === null || value === undefined || value === false || value === "") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    parts.push(String(value));
  };

  inputs.forEach(walk);
  return parts.join(" ");
}

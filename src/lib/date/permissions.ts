import { DateStatus } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

export type DateCapability = "plan" | "actuals" | "photo" | "review" | "memory" | "revisit";
const planning = [DateStatus.DRAFT, DateStatus.PLANNED, DateStatus.TODAY];
const recording = [DateStatus.TODAY, DateStatus.IN_PROGRESS, DateStatus.COMPLETED];
const reflection = [DateStatus.IN_PROGRESS, DateStatus.COMPLETED];
export const DATE_CAPABILITIES: Record<DateCapability, readonly DateStatus[]> = {
  plan: planning, actuals: recording, photo: recording,
  review: reflection, memory: reflection, revisit: reflection,
};
export function dateAllows(status: DateStatus, capability: DateCapability): boolean {
  return DATE_CAPABILITIES[capability].includes(status);
}
export function assertDateAllows(status: DateStatus, capability: DateCapability, message: string): void {
  if (!dateAllows(status, capability)) throw new ValidationError(message);
}

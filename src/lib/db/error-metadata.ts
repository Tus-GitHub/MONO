import type { Prisma } from "@prisma/client";

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;

function adapterCause(error: Prisma.PrismaClientKnownRequestError) {
  return record(record(error.meta?.driverAdapterError)?.cause);
}

/** Prisma's native engine and official pg adapter expose different metadata. */
export function databaseSqlState(error: Prisma.PrismaClientKnownRequestError) {
  return error.meta?.code ?? adapterCause(error)?.originalCode;
}

export function databaseConstraintTarget(error: Prisma.PrismaClientKnownRequestError) {
  return error.meta?.target ?? record(adapterCause(error)?.constraint)?.fields;
}

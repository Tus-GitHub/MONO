import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { databaseConstraintTarget, databaseSqlState } from "./error-metadata";

it.each(["40001", "40P01"])("recognizes adapter SQLSTATE %s without matching error messages", (code) => {
  const error = new Prisma.PrismaClientKnownRequestError("synthetic", {
    code: "P2010", clientVersion: "test", meta: { driverAdapterError: { cause: { originalCode: code } } },
  });
  expect(databaseSqlState(error)).toBe(code);
});

it("preserves the unique-name target from official adapter metadata", () => {
  const error = new Prisma.PrismaClientKnownRequestError("synthetic", {
    code: "P2002", clientVersion: "test", meta: { driverAdapterError: { cause: { originalCode: "23505", constraint: { fields: ["name"] } } } },
  });
  expect(databaseConstraintTarget(error)).toEqual(["name"]);
  expect(databaseSqlState(error)).toBe("23505");
});

it("ignores malformed adapter metadata", () => {
  const error = new Prisma.PrismaClientKnownRequestError("40001", {
    code: "P2010", clientVersion: "test", meta: { driverAdapterError: "40001" },
  });
  expect(databaseSqlState(error)).toBeUndefined();
});

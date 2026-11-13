import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const transaction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: transaction } }));
import { serializable } from "./serializable";
const conflict = () => new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" });
beforeEach(() => vi.resetAllMocks());
it("retries serialization conflicts using serializable isolation", async () => {
  transaction.mockRejectedValueOnce(conflict()).mockResolvedValueOnce("ok");
  const work = vi.fn();
  expect(await serializable(work)).toBe("ok");
  expect(transaction).toHaveBeenCalledTimes(2);
  expect(transaction).toHaveBeenCalledWith(work, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
});
it("bounds retries and surfaces persistent failures", async () => {
  transaction.mockRejectedValue(conflict());
  await expect(serializable(vi.fn())).rejects.toThrow("conflict");
  expect(transaction).toHaveBeenCalledTimes(3);
});
it("does not retry validation errors", async () => {
  transaction.mockRejectedValue(new Error("space full"));
  await expect(serializable(vi.fn())).rejects.toThrow("space full");
  expect(transaction).toHaveBeenCalledTimes(1);
});
it("honors an explicit transaction timeout without retrying expired transactions", async () => {
  const error = new Prisma.PrismaClientKnownRequestError("expired", { code: "P2028", clientVersion: "test" });
  transaction.mockRejectedValue(error);
  const work = vi.fn();
  await expect(serializable(work, { timeout: 30000 })).rejects.toBe(error);
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(transaction).toHaveBeenCalledWith(work, { isolationLevel: "Serializable", maxWait: 5000, timeout: 30000 });
});
it.each(["40001", "40P01"])("retries raw PostgreSQL serialization/deadlock errors (%s)", async (code) => {
  transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("retry", {
    code: "P2010", clientVersion: "test", meta: { code },
  })).mockResolvedValueOnce("ok");
  expect(await serializable(vi.fn())).toBe("ok");
  expect(transaction).toHaveBeenCalledTimes(2);
});
it("does not retry other raw SQL failures", async () => {
  transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("invalid", {
    code: "P2010", clientVersion: "test", meta: { code: "23514" },
  }));
  await expect(serializable(vi.fn())).rejects.toThrow("invalid");
  expect(transaction).toHaveBeenCalledTimes(1);
});

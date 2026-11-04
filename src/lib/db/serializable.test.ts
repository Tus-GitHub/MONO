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
  expect(transaction).toHaveBeenCalledWith(work, { isolationLevel: "Serializable" });
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

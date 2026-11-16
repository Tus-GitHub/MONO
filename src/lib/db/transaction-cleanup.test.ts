import { expect, it, vi } from "vitest";
import { releaseFailedCommit } from "./pg-adapter.mjs";

it("returns a failed commit's connection to the pool once and preserves its error", async () => {
  const error = new Error("commit conflict"), executeRaw = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(0), rollback = vi.fn(), commit = vi.fn();
  const tx = releaseFailedCommit({ executeRaw, rollback, commit });
  await expect(tx.executeRaw({ sql: "COMMIT", args: [], argTypes: [] })).rejects.toBe(error);
  expect(executeRaw).toHaveBeenLastCalledWith({ sql: "ROLLBACK", args: [], argTypes: [] });
  expect(rollback).toHaveBeenCalledTimes(1);
  await tx.rollback(); await tx.commit(); expect(rollback).toHaveBeenCalledTimes(1); expect(commit).not.toHaveBeenCalled();
});
it("leaves query-error cleanup to the engine and normal commits release once", async () => {
  const error = new Error("invalid query"), executeRaw = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(0), rollback = vi.fn(), commit = vi.fn();
  const tx = releaseFailedCommit({ executeRaw, rollback, commit });
  await expect(tx.executeRaw({ sql: "SELECT invalid", args: [], argTypes: [] })).rejects.toBe(error);
  expect(rollback).not.toHaveBeenCalled();
  await tx.executeRaw({ sql: "COMMIT", args: [], argTypes: [] }); await tx.commit(); await tx.commit(); expect(commit).toHaveBeenCalledTimes(1);
});

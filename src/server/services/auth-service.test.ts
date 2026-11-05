import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), claim: vi.fn(), updateUser: vi.fn(), deleteTokens: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/config/env", () => ({ env: { APP_URL: "https://mono.test" } }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: async () => "hash", needsRehash: vi.fn(), verifyPassword: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  passwordResetToken: { findUnique: mocks.findUnique }, $transaction: mocks.transaction,
} }));
import { completePasswordReset } from "./auth-service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue({ id: "reset", userId: "user", usedAt: null, expiresAt: new Date(Date.now() + 60_000), user: { id: "user", deletedAt: null } });
  mocks.claim.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation((callback) => callback({
    passwordResetToken: { updateMany: mocks.claim, deleteMany: mocks.deleteTokens },
    user: { update: mocks.updateUser, findFirst: async () => ({ id: "user" }) },
    $queryRaw: async () => [],
    authSession: { updateMany: vi.fn() }, pushSubscription: { deleteMany: vi.fn() },
  }));
});
const input = { token: "token", password: "NewPassword123!", confirmPassword: "NewPassword123!" };
it("updates the password and invalidates sessions only after claiming the single-use token", async () => {
  await completePasswordReset(input);
  expect(mocks.updateUser).toHaveBeenCalledWith({ where: { id: "user" }, data: { passwordHash: "hash", tokenVersion: { increment: 1 } } });
  expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUser.mock.invocationCallOrder[0]);
});
it("rejects a token already claimed by another reset request", async () => {
  mocks.claim.mockResolvedValue({ count: 0 });
  await expect(completePasswordReset(input)).rejects.toThrow("invalid or has expired");
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it("rejects expired links before hashing or changing the account", async () => {
  mocks.findUnique.mockResolvedValue({ usedAt: null, expiresAt: new Date(0), user: { deletedAt: null } });
  await expect(completePasswordReset(input)).rejects.toThrow("invalid or has expired");
  expect(mocks.transaction).not.toHaveBeenCalled();
});

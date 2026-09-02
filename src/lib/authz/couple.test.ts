import { beforeEach, describe, expect, it, vi } from "vitest";

// --- mocks: no real DB, no real session ----------------------------------
// `vi.hoisted` so the mock objects exist before `vi.mock` (which is hoisted to the top).
const prismaMock = vi.hoisted(() => ({
  coupleMember: { findFirst: vi.fn() },
  date: { findFirst: vi.fn() },
  place: { findFirst: vi.fn() },
  memory: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/current-user", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "a@b.c", name: "A" })),
}));

import {
  authorizeDate,
  authorizePlace,
  requireCoupleContext,
  requireCoupleMembership,
} from "@/lib/authz/couple";
import { AuthorizationError, NotFoundError } from "@/lib/errors";

const OWN_COUPLE = "couple-own";

beforeEach(() => {
  vi.clearAllMocks();
  // The session user is an active member of OWN_COUPLE.
  prismaMock.coupleMember.findFirst.mockResolvedValue({
    id: "m1",
    userId: "user-1",
    coupleId: OWN_COUPLE,
    role: "OWNER",
    status: "ACTIVE",
    couple: { id: OWN_COUPLE, deletedAt: null, status: "ACTIVE" },
  });
});

describe("couple isolation", () => {
  it("resolves the couple from the session only", async () => {
    const ctx = await requireCoupleContext();
    expect(ctx.couple.id).toBe(OWN_COUPLE);
  });

  it("authorizeDate scopes the query by the session's coupleId (never trusts the id alone)", async () => {
    prismaMock.date.findFirst.mockResolvedValue({ id: "date-1", coupleId: OWN_COUPLE });
    await authorizeDate("date-1");
    expect(prismaMock.date.findFirst).toHaveBeenCalledWith({
      where: { id: "date-1", coupleId: OWN_COUPLE, deletedAt: null },
    });
  });

  it("a resource in another couple is reported as NotFound (existence never leaks)", async () => {
    // The scoped query returns nothing because the row isn't in OWN_COUPLE.
    prismaMock.date.findFirst.mockResolvedValue(null);
    await expect(authorizeDate("foreign-date")).rejects.toBeInstanceOf(NotFoundError);

    prismaMock.place.findFirst.mockResolvedValue(null);
    await expect(authorizePlace("foreign-place")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("requireCoupleMembership rejects a mismatched couple id from the client", async () => {
    await expect(requireCoupleMembership("some-other-couple")).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(requireCoupleMembership(OWN_COUPLE)).resolves.toMatchObject({
      couple: { id: OWN_COUPLE },
    });
  });

  it("a user with no active couple cannot get a context", async () => {
    prismaMock.coupleMember.findFirst.mockResolvedValue(null);
    await expect(requireCoupleContext()).rejects.toThrow();
  });
});

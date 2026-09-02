import { beforeEach, describe, expect, it, vi } from "vitest";

// --- mocks: no real DB, no real session ----------------------------------
// `vi.hoisted` so the mock objects exist before `vi.mock` (which is hoisted to the top).
const prismaMock = vi.hoisted(() => ({
  coupleMember: { findFirst: vi.fn() },
  date: { findFirst: vi.fn() },
  place: { findFirst: vi.fn() },
  memory: { findFirst: vi.fn() },
  expense: { findFirst: vi.fn() },
  datePhoto: { findFirst: vi.fn() },
  dateReview: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/current-user", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "a@b.c", name: "A" })),
}));

import {
  authorizeDate,
  authorizeExpense,
  authorizeMemory,
  authorizePhoto,
  authorizePlace,
  authorizeReview,
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

describe("every couple-scoped resource authorizer refuses a foreign id as NotFound", () => {
  it("photos, expenses, memories and reviews all 404 when the scoped query finds nothing", async () => {
    prismaMock.datePhoto.findFirst.mockResolvedValue(null);
    prismaMock.expense.findFirst.mockResolvedValue(null);
    prismaMock.memory.findFirst.mockResolvedValue(null);
    prismaMock.dateReview.findFirst.mockResolvedValue(null);

    await expect(authorizePhoto("foreign-photo")).rejects.toBeInstanceOf(NotFoundError);
    await expect(authorizeExpense("foreign-expense")).rejects.toBeInstanceOf(NotFoundError);
    await expect(authorizeMemory("foreign-memory")).rejects.toBeInstanceOf(NotFoundError);
    await expect(authorizeReview("foreign-review")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("scopes each query by the session couple id, not by the client-supplied id alone", async () => {
    prismaMock.expense.findFirst.mockResolvedValue({ id: "e1", coupleId: OWN_COUPLE });
    await authorizeExpense("e1");
    expect(prismaMock.expense.findFirst).toHaveBeenCalledWith({
      where: { id: "e1", coupleId: OWN_COUPLE, deletedAt: null },
    });

    // photos + reviews reach the couple by walking the owning date
    prismaMock.datePhoto.findFirst.mockResolvedValue({ id: "p1", date: { coupleId: OWN_COUPLE } });
    await authorizePhoto("p1");
    const photoWhere = prismaMock.datePhoto.findFirst.mock.calls[0][0].where;
    expect(photoWhere.date.coupleId).toBe(OWN_COUPLE);

    prismaMock.dateReview.findFirst.mockResolvedValue({ id: "r1", date: { coupleId: OWN_COUPLE } });
    await authorizeReview("r1");
    const reviewWhere = prismaMock.dateReview.findFirst.mock.calls[0][0].where;
    expect(reviewWhere.date.coupleId).toBe(OWN_COUPLE);
  });
});

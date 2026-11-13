import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
import type { Prisma } from "@prisma/client";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
const mail = vi.hoisted(() => ({ verify: vi.fn(), welcome: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendVerificationEmail: mail.verify, sendWelcomeEmail: mail.welcome }));

import { prisma } from "@/lib/db/prisma";
import { createCoupleForUser, joinCoupleByInviteCode } from "@/server/services/couple-service";
import { createInvitation, acceptInvitation } from "@/server/services/invitation-service";
import { beginEmailVerification, completeEmailVerification } from "@/server/services/email-verification-service";

let owner: { id: string; email: string };
let partner: { id: string; email: string };
const input = { currency: "USD", timezone: "UTC" };
beforeEach(async () => {
  vi.clearAllMocks();
  const run = randomUUID();
  owner = await prisma.user.create({ data: { name: `Verified owner ${run}`, email: `owner-${run}@example.invalid`, emailVerified: new Date() } });
  partner = await prisma.user.create({ data: { name: `Unverified partner ${run}`, email: `partner-${run}@example.invalid` } });
});
afterEach(async () => {
  await prisma.couple.deleteMany({ where: { createdById: { in: [owner.id, partner.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, partner.id] } } });
});
afterAll(() => prisma.$disconnect());

const createSpace = () => asUser(owner.id, () => createCoupleForUser(owner.id, input));
const verifyPartner = () => prisma.user.update({ where: { id: partner.id }, data: { emailVerified: new Date() } });

it("rejects unverified space creation at the service boundary without writing membership", async () => {
  await expect(asUser(partner.id, () => createCoupleForUser(partner.id, input))).rejects.toMatchObject({ httpStatus: 403 });
  expect(await prisma.couple.count({ where: { createdById: partner.id } })).toBe(0);
  expect(await prisma.coupleMember.count({ where: { userId: partner.id } })).toBe(0);
  await verifyPartner();
  await expect(asUser(partner.id, () => createCoupleForUser(partner.id, input))).resolves.toMatchObject({ status: "PENDING" });
});

it("keeps an invitation unused while unverified, then accepts the same link after real confirmation", async () => {
  const space = await createSpace();
  const invite = await asUser(owner.id, () => createInvitation(space.id, owner.id, { email: partner.email }));
  await expect(asUser(partner.id, () => acceptInvitation(invite.token, partner.id))).rejects.toMatchObject({ httpStatus: 403 });
  expect((await prisma.coupleInvitation.findUniqueOrThrow({ where: { id: invite.invitation.id } })).acceptedAt).toBeNull();
  expect(await prisma.coupleMember.count({ where: { coupleId: space.id } })).toBe(1);
  await beginEmailVerification(partner.email);
  const raw = new URLSearchParams(new URL(mail.verify.mock.calls[0][0].verifyUrl).hash.slice(1)).get("token")!;
  await completeEmailVerification(raw);
  await asUser(partner.id, () => acceptInvitation(invite.token, partner.id));
  expect(await prisma.coupleMember.count({ where: { coupleId: space.id } })).toBe(2);
  expect(await prisma.notification.count({ where: { coupleId: space.id, type: "PARTNER_JOINED" } })).toBe(1);
  await expect(asUser(partner.id, () => acceptInvitation(invite.token, partner.id))).rejects.toThrow("already used");
});

it("blocks code joins until verified and preserves the space for a later retry", async () => {
  const space = await createSpace();
  await expect(asUser(partner.id, () => joinCoupleByInviteCode(partner.id, { inviteCode: space.inviteCode }))).rejects.toMatchObject({ httpStatus: 403 });
  expect((await prisma.couple.findUniqueOrThrow({ where: { id: space.id } })).status).toBe("PENDING");
  await verifyPartner();
  await asUser(partner.id, () => joinCoupleByInviteCode(partner.id, { inviteCode: space.inviteCode }));
  expect(await prisma.coupleMember.count({ where: { coupleId: space.id } })).toBe(2);
});

it("requires existing unverified owners to verify before issuing more invitations", async () => {
  const space = await createSpace();
  await prisma.user.update({ where: { id: owner.id }, data: { emailVerified: null } });
  await expect(asUser(owner.id, () => createInvitation(space.id, owner.id))).rejects.toMatchObject({ httpStatus: 403 });
});

it.each(["link", "code"])("commits a %s join and notification despite round trips exceeding Prisma's old five-second limit", async (kind) => {
  const space = await createSpace();
  const invite = await asUser(owner.id, () => createInvitation(space.id, owner.id));
  await verifyPartner();
  const originalMethod = prisma.$transaction;
  const original = originalMethod.bind(prisma);
  prisma.$transaction = ((work: Parameters<typeof original>[0], options: Parameters<typeof original>[1]) =>
    original(async (tx) => {
      await tx.$queryRaw`SELECT pg_sleep(5.2)::text`;
      return (work as (client: Prisma.TransactionClient) => Promise<unknown>)(tx);
    }, options)) as typeof prisma.$transaction;
  try {
    await asUser(partner.id, () => kind === "link"
      ? acceptInvitation(invite.token, partner.id)
      : joinCoupleByInviteCode(partner.id, { inviteCode: space.inviteCode }));
  } finally { prisma.$transaction = originalMethod; }
  expect(await prisma.coupleMember.count({ where: { coupleId: space.id } })).toBe(2);
  expect(await prisma.notification.count({ where: { coupleId: space.id, type: "PARTNER_JOINED" } })).toBe(1);
});

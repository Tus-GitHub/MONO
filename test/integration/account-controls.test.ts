import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";

vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: async () => {
    const id = testUser.getStore();
    if (!id) throw new Error("Missing test user.");
    return prisma.user.findUniqueOrThrow({ where: { id } });
  } };
});

import { prisma } from "@/lib/db/prisma";
import { deleteAccount } from "@/server/services/account-service";
import { createCoupleForUser, disconnectCouple, joinCoupleByInviteCode } from "@/server/services/couple-service";
import { acceptInvitation, createInvitation } from "@/server/services/invitation-service";
import { setPushSubscription } from "@/server/services/notification-preference-service";
import { sha256 } from "@/lib/utils/crypto";
import { createECDH, randomBytes } from "node:crypto";

let users: string[] = [];
let couples: string[] = [];
let dateId: string;
let invitationToken: string;

beforeEach(async () => {
  const key = randomUUID();
  users = (await Promise.all([0, 1, 2].map((n) => prisma.user.create({
    data: { email: `accounts-${key}-${n}@example.invalid`, name: `Account fixture ${n}`, passwordHash: "fixture-hash" },
  })))).map((user) => user.id);
  couples = [(await prisma.couple.create({ data: {
    createdById: users[0], inviteCode: key, status: "ACTIVE",
    members: { create: [{ userId: users[0], role: "OWNER" }, { userId: users[1], role: "PARTNER" }] },
  } })).id];
  dateId = (await prisma.date.create({ data: { coupleId: couples[0], createdById: users[0], title: "Retained history" } })).id;
  await prisma.dateReminder.create({ data: { dateId, userId: users[1], kind: "CUSTOM", scheduledFor: new Date() } });
  invitationToken = randomUUID();
  await prisma.coupleInvitation.create({ data: { coupleId: couples[0], createdById: users[0], tokenHash: sha256(invitationToken), expiresAt: new Date(Date.now() + 60_000) } });
  await prisma.account.create({ data: { userId: users[0], provider: "GOOGLE", providerAccountId: key, accessToken: "fixture-oauth" } });
  await prisma.passwordResetToken.create({ data: { userId: users[0], tokenHash: key, expiresAt: new Date(Date.now() + 60_000) } });
  await prisma.authSession.create({ data: { userId: users[0], tokenVersion: 0, deviceLabel: "Fixture browser", expiresAt: new Date(Date.now() + 60_000) } });
  const device = await prisma.pushSubscription.create({ data: { userId: users[0], endpoint: `https://fcm.googleapis.com/${key}`, data: {} } });
  await prisma.notificationPreference.create({ data: { userId: users[0], pushEnabled: true, pushSubscription: { legacy: true } } });
  const note = await prisma.notification.create({ data: { userId: users[1], coupleId: couples[0], type: "SYSTEM", title: "Fixture" } });
  await prisma.notificationDelivery.create({ data: { notificationId: note.id, userId: users[1], subscriptionId: device.id } });
});

afterEach(async () => {
  // Include any space created by a racing operation that committed before deletion.
  const owned = await prisma.couple.findMany({ where: { createdById: { in: users } }, select: { id: true } });
  await prisma.couple.deleteMany({ where: { id: { in: [...couples, ...owned.map((row) => row.id)] } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});
afterAll(() => prisma.$disconnect());

it("deletes credentials and revokes access atomically while preserving shared authored history", async () => {
  await asUser(users[0], () => deleteAccount(users[0]));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: users[0] } });
  expect(user.deletedAt).not.toBeNull();
  expect(user.tokenVersion).toBe(1);
  expect(user.passwordHash).toBeNull();
  expect(await prisma.account.count({ where: { userId: users[0] } })).toBe(0);
  expect(await prisma.passwordResetToken.count({ where: { userId: users[0] } })).toBe(0);
  expect(await prisma.pushSubscription.count({ where: { userId: users[0] } })).toBe(0);
  expect(await prisma.authSession.count({ where: { userId: users[0], revokedAt: null } })).toBe(0);
  expect(await prisma.coupleMember.count({ where: { coupleId: couples[0], status: "ACTIVE" } })).toBe(0);
  expect((await prisma.couple.findUniqueOrThrow({ where: { id: couples[0] } })).status).toBe("ARCHIVED");
  expect((await prisma.coupleInvitation.findFirstOrThrow({ where: { coupleId: couples[0] } })).revokedAt).not.toBeNull();
  expect((await prisma.dateReminder.findFirstOrThrow({ where: { dateId } })).dismissedAt).not.toBeNull();
  expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { notification: { coupleId: couples[0] } } })).status).toBe("CANCELLED");
  expect((await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: users[0] } })).pushEnabled).toBe(false);
  expect(await prisma.date.count({ where: { id: dateId } })).toBe(1);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users[1] } })).deletedAt).toBeNull();
});

it("rejects deletion or disconnection for a foreign account/space at the service boundary", async () => {
  await expect(asUser(users[2], () => deleteAccount(users[0]))).rejects.toMatchObject({ httpStatus: 403 });
  await expect(asUser(users[2], () => disconnectCouple(couples[0]))).rejects.toMatchObject({ httpStatus: 409 });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).deletedAt).toBeNull();
});

it("rolls back membership, capabilities and credentials if the final account update fails", async () => {
  await prisma.user.update({ where: { id: users[0] }, data: { tokenVersion: 2147483647 } });
  await expect(asUser(users[0], () => deleteAccount(users[0]))).rejects.toThrow();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).deletedAt).toBeNull();
  expect((await prisma.couple.findUniqueOrThrow({ where: { id: couples[0] } })).status).toBe("ACTIVE");
  expect(await prisma.coupleMember.count({ where: { coupleId: couples[0], status: "ACTIVE" } })).toBe(2);
  expect(await prisma.authSession.count({ where: { userId: users[0], revokedAt: null } })).toBe(1);
  expect(await prisma.account.count({ where: { userId: users[0] } })).toBe(1);
  expect(await prisma.passwordResetToken.count({ where: { userId: users[0] } })).toBe(1);
  expect(await prisma.pushSubscription.count({ where: { userId: users[0] } })).toBe(1);
  expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { notification: { coupleId: couples[0] } } })).status).toBe("PENDING");
  expect((await prisma.coupleInvitation.findFirstOrThrow({ where: { coupleId: couples[0] } })).revokedAt).toBeNull();
});

it("serializes account deletion against new-space creation", async () => {
  await Promise.allSettled([
    asUser(users[2], () => createCoupleForUser(users[2], { name: "Race fixture", currency: "USD", timezone: "UTC" })),
    asUser(users[2], () => deleteAccount(users[2])),
  ]);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users[2] } })).deletedAt).not.toBeNull();
  expect(await prisma.coupleMember.count({ where: { userId: users[2], status: "ACTIVE" } })).toBe(0);
});

it.each(["code", "link"])("serializes deletion against invite acceptance (%s)", async (kind) => {
  const pending = await asUser(users[2], () => createCoupleForUser(users[2], { name: "Pending fixture", currency: "USD", timezone: "UTC" }));
  couples.push(pending.id);
  const invite = await asUser(users[2], () => createInvitation(pending.id, users[2]));
  await asUser(users[0], () => disconnectCouple(couples[0]));
  await Promise.allSettled([
    asUser(users[0], () => kind === "code" ? joinCoupleByInviteCode(users[0], { inviteCode: pending.inviteCode }) : acceptInvitation(invite.token, users[0])),
    asUser(users[0], () => deleteAccount(users[0])),
  ]);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).deletedAt).not.toBeNull();
  expect(await prisma.coupleMember.count({ where: { userId: users[0], status: "ACTIVE" } })).toBe(0);
});

it("refuses stale invite and push writes after deletion or archiving", async () => {
  await asUser(users[0], () => deleteAccount(users[0]));
  await expect(asUser(users[0], () => createCoupleForUser(users[0], { currency: "USD", timezone: "UTC" }))).rejects.toMatchObject({ httpStatus: 401 });
  await expect(asUser(users[0], () => createInvitation(couples[0], users[0]))).rejects.toThrow();
  await expect(asUser(users[2], () => acceptInvitation(invitationToken, users[2]))).rejects.toThrow();
  const curve = createECDH("prime256v1"); curve.generateKeys();
  await expect(setPushSubscription(users[0], { endpoint: "https://fcm.googleapis.com/fcm/send/fixture", keys: { p256dh: curve.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } })).rejects.toMatchObject({ httpStatus: 401 });
  expect(await prisma.pushSubscription.count({ where: { userId: users[0] } })).toBe(0);
});

it("revokes any invitation issued concurrently with archiving", async () => {
  const pending = await asUser(users[2], () => createCoupleForUser(users[2], { currency: "USD", timezone: "UTC" }));
  couples.push(pending.id);
  await Promise.allSettled([
    asUser(users[2], () => createInvitation(pending.id, users[2])),
    asUser(users[2], () => disconnectCouple(pending.id)),
  ]);
  expect((await prisma.couple.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("ARCHIVED");
  expect(await prisma.coupleInvitation.count({ where: { coupleId: pending.id, revokedAt: null, acceptedAt: null } })).toBe(0);
});

it("rejects a link addressed to a different email without consuming it", async () => {
  const pending = await asUser(users[2], () => createCoupleForUser(users[2], { currency: "USD", timezone: "UTC" }));
  couples.push(pending.id);
  const invite = await asUser(users[2], () => createInvitation(pending.id, users[2], { email: "intended@example.invalid" }));
  await asUser(users[0], () => disconnectCouple(couples[0]));
  await expect(asUser(users[0], () => acceptInvitation(invite.token, users[0]))).rejects.toMatchObject({ httpStatus: 422 });
  expect((await prisma.coupleInvitation.findUniqueOrThrow({ where: { id: invite.invitation.id } })).acceptedAt).toBeNull();
  expect(await prisma.coupleMember.count({ where: { userId: users[0], status: "ACTIVE" } })).toBe(0);
});

it("does not recreate a push capability when registration races account deletion", async () => {
  const curve = createECDH("prime256v1"); curve.generateKeys();
  await Promise.allSettled([
    setPushSubscription(users[0], { endpoint: `https://fcm.googleapis.com/fcm/send/${randomUUID()}`, keys: { p256dh: curve.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } }),
    asUser(users[0], () => deleteAccount(users[0])),
  ]);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).deletedAt).not.toBeNull();
  expect(await prisma.pushSubscription.count({ where: { userId: users[0] } })).toBe(0);
});

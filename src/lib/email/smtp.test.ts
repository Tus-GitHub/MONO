import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(), createTransport: vi.fn(),
  env: { SMTP_HOST: "smtp.example.test", SMTP_PORT: 587, SMTP_SECURE: false,
    SMTP_USER: "user", SMTP_PASSWORD: "secret", EMAIL_FROM: "MONO <mono@example.test>" },
}));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));
vi.mock("@/config/env", () => ({ env: mocks.env }));
import { SmtpEmailDriver } from "./smtp";

const message = { to: "recipient@example.test", subject: "Reset", text: "Reset link" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.SMTP_HOST = "smtp.example.test";
  mocks.env.SMTP_SECURE = false;
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ accepted: [message.to], rejected: [] });
});

it("requires STARTTLS and reuses the configured transport", async () => {
  const driver = new SmtpEmailDriver();
  await driver.send(message);
  await driver.send(message);
  expect(mocks.createTransport).toHaveBeenCalledOnce();
  expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({
    secure: false, requireTLS: true, disableFileAccess: true, disableUrlAccess: true,
    auth: { user: "user", pass: "secret" },
  }));
  expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ ...message, from: mocks.env.EMAIL_FROM }));
});

it("supports implicit TLS", async () => {
  mocks.env.SMTP_SECURE = true;
  await new SmtpEmailDriver().send(message);
  expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true, requireTLS: false }));
});

it("rejects missing credentials without opening a connection", async () => {
  mocks.env.SMTP_HOST = "";
  await expect(new SmtpEmailDriver().send(message)).rejects.toThrow("configuration");
  expect(mocks.createTransport).not.toHaveBeenCalled();
});

it("does not report a rejected recipient as delivered", async () => {
  mocks.sendMail.mockResolvedValue({ accepted: [], rejected: [message.to] });
  await expect(new SmtpEmailDriver().send(message)).rejects.toThrow("recipient");
});

it("propagates transport failures", async () => {
  mocks.sendMail.mockRejectedValue(new Error("connection failed"));
  await expect(new SmtpEmailDriver().send(message)).rejects.toThrow("connection failed");
});

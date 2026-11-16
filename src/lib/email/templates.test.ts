import { describe, expect, it } from "vitest";
import { passwordResetEmail, welcomeEmail, verificationEmail, chatResetEmail } from "./templates";

const args = { to: "person@example.test", name: "Alex", resetUrl: "https://mono.example/reset-password?token=private-token&source=email", expiresInMinutes: 30 };
it("explains both-partner chat approval without placing an OTP in a URL", () => {
  const message = chatResetEmail({ to: args.to, name: "Alex", requesterName: "<Partner>", code: "012345", reference: "abcdef01", chatUrl: "https://mono.example/chat" });
  expect(message.html).toContain("&lt;Partner&gt;");
  expect(message.text).toContain("012345");
  expect(message.text).toContain("Both email codes must be entered together");
  expect(message.text).toContain("10 minutes");
  expect(message.text).toContain("dates, Memories, other photos, expenses and games stay unchanged");
  expect(message.text).toContain("permanently deletes all old chat messages and attachments");
  expect(message.text).toContain("cannot be undone");
  expect(message.text).toContain("never sent in email");
  expect(message.html!.match(/href="[^"]*012345/g)).toBeNull();
});

describe("AMOR password recovery email", () => {
  it("contains its own branding, HTML and plain-text recovery instructions", () => {
    const message = passwordResetEmail(args);
    expect(message.to).toBe(args.to);
    expect(message.subject).toBe("Reset your AMOR password");
    expect(message.html).toContain("A private space for two.");
    expect(message.html).toContain("Choose a new password");
    expect(message.html).toContain("30 minutes");
    expect(message.html).toContain("can be used once");
    expect(message.text).toContain(args.resetUrl);
    expect(message.html).not.toMatch(/QuestMart|Jagdamba|Travel Agent|<script|<img/i);
  });
  it("escapes names and link attributes so user content cannot become email HTML", () => {
    const message = passwordResetEmail({ ...args, name: '<img src=x onerror="bad()"> & Alex\'s' });
    expect(message.html).toContain("&lt;img");
    expect(message.html).toContain("&quot;bad()&quot;");
    expect(message.html).toContain("&amp; Alex&#39;s");
    expect(message.html).toContain("private-token&amp;source=email");
    expect(message.html).not.toContain("<img");
  });
  it("rejects unsafe protocols, credentials in URLs and non-local HTTP links", () => {
    for (const resetUrl of ["javascript:alert(1)", "https://user:secret@mono.example/reset", "http://mono.example/reset"]) {
      expect(() => passwordResetEmail({ ...args, resetUrl })).toThrow("HTTPS link");
    }
    expect(passwordResetEmail({ ...args, resetUrl: "http://localhost:3000/reset-password?token=test" }).html).toContain("localhost:3000");
  });
});

describe("registration emails", () => {
  it("welcomes new accounts with an onboarding link and a distinct AMOR message", () => {
    const message = welcomeEmail({ to: args.to, name: "Alex", appUrl: "https://mono.example/onboarding" });
    expect(message.subject).toBe("Welcome to AMOR");
    expect(message.html).toContain("Make time.<br>Keep the memory.");
    expect(message.text).toContain("separate email to confirm");
    expect(message.text).toContain("https://mono.example/onboarding");
  });
  it("includes a private fragment link, 24-hour expiry and explicit confirmation instructions", () => {
    const message = verificationEmail({ to: args.to, name: "<Alex>", verifyUrl: "https://mono.example/verify-email#token=test&other=value" });
    expect(message.subject).toBe("Verify your AMOR email");
    expect(message.html).toContain("&lt;Alex&gt;");
    expect(message.html).toContain("#token=test&amp;other=value");
    expect(message.text).toContain("24 hours");
    expect(message.text).toContain("does not sign anyone in");
    expect(message.text).toContain("confirmation page");
  });
  it("applies the same URL safety rules to welcome and verification messages", () => {
    expect(() => welcomeEmail({ ...args, appUrl: "javascript:alert(1)" })).toThrow("HTTPS link");
    expect(() => verificationEmail({ ...args, verifyUrl: "http://untrusted.example/verify" })).toThrow("HTTPS link");
  });
});

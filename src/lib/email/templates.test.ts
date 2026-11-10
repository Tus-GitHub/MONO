import { describe, expect, it } from "vitest";
import { passwordResetEmail } from "./templates";

const args = { to: "person@example.test", name: "Alex", resetUrl: "https://mono.example/reset-password?token=private-token&source=email", expiresInMinutes: 30 };

describe("MONO password recovery email", () => {
  it("contains its own branding, HTML and plain-text recovery instructions", () => {
    const message = passwordResetEmail(args);
    expect(message.to).toBe(args.to);
    expect(message.subject).toBe("Reset your MONO password");
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

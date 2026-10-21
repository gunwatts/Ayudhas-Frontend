import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BackupPasswordError, decryptBackup, encryptBackup, isEncryptedBackup, passwordProblem } from "@/lib/backup-crypto";

// Encrypted by the Ayudhas Pro app's own backupCrypto.ts (finance-only export), password "app-to-web-8".
const appFile = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "app-finance.encrypted.json"), "utf8"));

describe("backup encryption (compatible with the Ayudhas Pro app)", () => {
  it("opens a backup encrypted by the app", async () => {
    expect(isEncryptedBackup(appFile)).toBe(true);
    const backup = JSON.parse(await decryptBackup(appFile, "app-to-web-8"));
    expect(backup.type).toBe("LIFE_TRACKER_BACKUP");
    expect(backup.metadata.source).toBe("ayudhas-pro-app");
    expect(backup.tables.fin_transactions.length).toBeGreaterThan(0);
  });

  it("rejects a wrong password and any change to the file", async () => {
    await expect(decryptBackup(appFile, "not-the-password")).rejects.toBeInstanceOf(BackupPasswordError);
    // The header is authenticated: lowering the iterations (or any other change) is detected.
    await expect(decryptBackup({ ...appFile, kdf: { ...appFile.kdf, iterations: appFile.kdf.iterations + 1 } }, "app-to-web-8")).rejects.toBeInstanceOf(BackupPasswordError);
    await expect(decryptBackup({ ...appFile, kdf: { ...appFile.kdf, iterations: 1000 } }, "app-to-web-8")).rejects.toThrow(/damaged/);
  });

  it("round-trips with a fresh salt and nonce each time", async () => {
    const a = await encryptBackup('{"hello":"₹ नमस्ते"}', "web-pass-123", 100_000);
    const b = await encryptBackup('{"hello":"₹ नमस्ते"}', "web-pass-123", 100_000);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.nonce).not.toBe(b.cipher.nonce);
    expect(a.data).not.toContain("hello");
    expect(JSON.parse(await decryptBackup(a, "web-pass-123"))).toEqual({ hello: "₹ नमस्ते" });
    expect(a.kdf.iterations).toBe(100_000);
    expect((await encryptBackup("{}", "web-pass-123")).kdf.iterations).toBe(210_000);
  });

  it("asks for a usable password", async () => {
    expect(passwordProblem("short")).toMatch(/8 characters/);
    expect(passwordProblem("long-enough", "different")).toMatch(/don't match/);
    expect(passwordProblem("long-enough", "long-enough")).toBeNull();
    await expect(encryptBackup("{}", "short")).rejects.toBeInstanceOf(BackupPasswordError);
  });
});

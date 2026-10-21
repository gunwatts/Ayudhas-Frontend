import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BackupTransferCard } from "@/components/backup-transfer";

const summary = (dry_run: boolean, added: number) => ({
  dry_run,
  tables: {
    fin_accounts: { label: "Accounts", incoming: 2, added: 0, matched: 2, skipped: 0 },
    fin_transactions: { label: "Transactions", incoming: 5, added, matched: 5 - added, skipped: 0 },
  },
  added,
  matched: 7 - added,
  skipped: 0,
  notes: ["The app's audit log stays on the phone; it isn't copied to the website."],
});

describe("Backup & transfer", () => {
  it("previews an unencrypted app backup, then imports it", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = new URL(url);
        calls.push(`${u.pathname}${u.search}`);
        return new Response(JSON.stringify(summary(u.searchParams.has("dry_run"), 3)), { status: 200 });
      }),
    );
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <BackupTransferCard />
      </QueryClientProvider>,
    );
    const file = new File([JSON.stringify({ type: "LIFE_TRACKER_BACKUP", formatVersion: 3, tables: {} })], "AyudhasPro_Finance.json", { type: "application/json" });
    await userEvent.upload(document.getElementById("backup-file") as HTMLInputElement, file);
    expect(await screen.findByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText(/3 new records will be added/)).toBeInTheDocument();
    expect(screen.getByText(/audit log stays on the phone/)).toBeInTheDocument();
    expect(calls).toEqual(["/api/v1/transfer/import?dry_run=true"]);

    await userEvent.click(screen.getByRole("button", { name: /Import 3 records/ }));
    expect(calls).toEqual(["/api/v1/transfer/import?dry_run=true", "/api/v1/transfer/import"]);
    expect(screen.queryByText("Transactions")).not.toBeInTheDocument();
  });

  it("asks for the password of an encrypted backup", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BackupTransferCard />
      </QueryClientProvider>,
    );
    const envelope = { type: "AYUDHAS_ENCRYPTED_BACKUP", version: 1, kdf: {}, cipher: {}, data: "" };
    await userEvent.upload(document.getElementById("backup-file") as HTMLInputElement, new File([JSON.stringify(envelope)], "b.json"));
    expect(await screen.findByLabelText("Password of this backup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unlock/ })).toBeDisabled();
  });

  it("won't encrypt with a short or mismatched password", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BackupTransferCard />
      </QueryClientProvider>,
    );
    await userEvent.type(screen.getByLabelText("Backup password"), "longenough");
    await userEvent.type(screen.getByLabelText("Repeat the password"), "different1");
    await userEvent.click(screen.getByRole("button", { name: /Download encrypted backup/ }));
    expect(await screen.findByText(/don't match/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

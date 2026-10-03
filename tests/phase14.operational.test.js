import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

const approvedFunctions = [
  "qualifyNewLead",
  "scanStaleOpportunities",
  "recheckStaleOpportunity",
  "generateWeeklySalesReport",
];

describe("Phase 14 operational safeguards", () => {
  it("keeps the approved manifest exact and excludes retry-sensitive functions", async () => {
    const manifest = JSON.parse(await readFile(
      new URL("../tools/phase14/firebase-deployment-manifest.json", import.meta.url),
      "utf8"
    ));

    expect(manifest.functions).toEqual(approvedFunctions);
    expect(manifest.excludedRetrySensitiveFunctions).toEqual([
      "createNewLeadNotifications",
      "deliverNotificationEmail",
      "createDailyReminderNotifications",
    ]);
    expect(new Set(manifest.functions).size).toBe(4);
  });

  it("requires completed backup and reconciliation evidence before deployment", async () => {
    const script = await readFile(
      new URL("../tools/phase14/Deploy-Phase14Functions.ps1", import.meta.url),
      "utf8"
    );

    expect(script).toContain("firestoreExport.status");
    expect(script).toContain('"SUCCESSFUL"');
    expect(script).toContain("authentication.snapshotComplete");
    expect(script).toContain("storage.snapshotComplete");
    expect(script).toContain("if (-not $Execute)");
    expect(script).toContain("npx --no-install firebase deploy");
    expect(script).not.toContain("--only functions\"");
  });

  it("requires an explicit managed export and defaults backup to dry run", async () => {
    const script = await readFile(
      new URL("../tools/phase14/Invoke-Phase14Backup.ps1", import.meta.url),
      "utf8"
    );

    expect(script).toContain("[Parameter(Mandatory = $true)]");
    expect(script).toContain("gcloud firestore export");
    expect(script).toContain('status = "SUCCESSFUL"');
    expect(script).toContain("EvidenceOutput");
    expect(script).toContain("if (-not $Execute)");
  });

  it("keeps reconciliation read-only and privacy-safe", async () => {
    const script = await readFile(
      new URL("../functions/scripts/phase14-reconcile.js", import.meta.url),
      "utf8"
    );

    expect(script).toContain("refuseEmulators");
    expect(script).toContain("Dry run only");
    expect(script).toContain("listUsers");
    expect(script).toContain("countStorageObjects");
    expect(script).toContain("Existing evidence belongs to a different project");
    expect(script).toContain("firestoreExport: existing.firestoreExport");
    expect(script).not.toMatch(/\.set\(|\.create\(|\.update\(|\.delete\(/);
  });
});

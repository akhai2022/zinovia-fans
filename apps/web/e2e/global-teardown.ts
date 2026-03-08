/**
 * Global teardown — runs after all tests complete.
 * Cleans up test accounts created during the run.
 */

import { cleanupTestAccounts, getTrackedAccounts } from "./helpers";

export default async function globalTeardown() {
  const accounts = getTrackedAccounts();
  if (accounts.length === 0) return;

  console.log(`\n[teardown] Cleaning up ${accounts.length} test account(s)...`);
  const result = await cleanupTestAccounts();
  console.log(
    `[teardown] Cleanup complete: ${result.cleaned} cleaned, ${result.failed} failed`,
  );
}

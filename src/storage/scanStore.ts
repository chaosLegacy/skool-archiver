import type { ScanState } from "@/types";

const SCAN_STATE_KEY = "scanState";

export async function getScanState(): Promise<ScanState> {
  const stored = await chrome.storage.local.get(SCAN_STATE_KEY);
  return (stored[SCAN_STATE_KEY] as ScanState | undefined) ?? { status: "idle" };
}

export async function saveScanState(scan: ScanState): Promise<void> {
  await chrome.storage.local.set({ [SCAN_STATE_KEY]: scan });
}

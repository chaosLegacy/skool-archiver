import { ArchiveSettings, DEFAULT_SETTINGS } from "@/types";

const SETTINGS_KEY = "settings";

export async function getSettings(): Promise<ArchiveSettings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<ArchiveSettings> | undefined;
  if (!value) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    exportFormats: { ...DEFAULT_SETTINGS.exportFormats, ...value.exportFormats }
  };
}

export async function saveSettings(settings: ArchiveSettings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

export function onSettingsChanged(callback: (settings: ArchiveSettings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== "sync" || !changes[SETTINGS_KEY]) return;
    callback(changes[SETTINGS_KEY].newValue as ArchiveSettings);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

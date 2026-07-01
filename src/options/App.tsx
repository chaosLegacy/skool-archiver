import { useEffect, useState, type ReactNode } from "react";
import type { ArchiveSettings, ExportFormat } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";
import { sendRuntimeMessage } from "@/utils/messaging";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  html: "HTML",
  markdown: "Markdown",
  json: "JSON"
};

export default function App() {
  const [settings, setSettings] = useState<ArchiveSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    sendRuntimeMessage<{ type: "SETTINGS_RESULT"; settings: ArchiveSettings }>({
      type: "GET_SETTINGS"
    }).then((res) => setSettings(res.settings));
  }, []);

  async function update(partial: Partial<ArchiveSettings>): Promise<void> {
    const next = { ...settings, ...partial };
    setSettings(next);
    await sendRuntimeMessage({ type: "UPDATE_SETTINGS", settings: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function toggleFormat(format: ExportFormat): void {
    void update({ exportFormats: { ...settings.exportFormats, [format]: !settings.exportFormats[format] } });
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Skool Archiver Settings</h1>
        {saved && <span className="text-xs text-emerald-600">Saved</span>}
      </div>

      <Section title="Export formats">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((format) => (
            <Toggle
              key={format}
              label={FORMAT_LABELS[format]}
              checked={settings.exportFormats[format]}
              onChange={() => toggleFormat(format)}
            />
          ))}
        </div>
      </Section>

      <Section title="Downloads">
        <Toggle
          label="Download images"
          checked={settings.downloadImages}
          onChange={() => update({ downloadImages: !settings.downloadImages })}
        />
        <Toggle
          label="Download videos where available"
          checked={settings.downloadVideos}
          onChange={() => update({ downloadVideos: !settings.downloadVideos })}
        />
        <label className="flex items-center justify-between mt-3 text-sm">
          <span>Maximum parallel downloads</span>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.maxParallelDownloads}
            onChange={(e) => update({ maxParallelDownloads: Number(e.target.value) || 1 })}
            className="w-16 rounded border border-neutral-300 dark:border-neutral-600 bg-transparent px-2 py-1 text-right"
          />
        </label>
      </Section>

      <Section title="Output">
        <label className="flex flex-col gap-1 text-sm">
          <span>Filename format</span>
          <input
            type="text"
            value={settings.filenameFormat}
            onChange={(e) => update({ filenameFormat: e.target.value })}
            className="rounded border border-neutral-300 dark:border-neutral-600 bg-transparent px-2 py-1.5"
          />
          <span className="text-xs text-neutral-500">
            Available tokens: {"{order}"}, {"{title}"}
          </span>
        </label>
      </Section>

      <Section title="Appearance">
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => update({ theme })}
              className={`rounded-md px-3 py-1.5 text-sm capitalize border ${
                settings.theme === theme
                  ? "border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-300 dark:border-neutral-600"
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">{title}</h2>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center justify-between text-sm cursor-pointer select-none">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4" />
    </label>
  );
}

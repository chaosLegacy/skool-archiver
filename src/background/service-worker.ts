import { getCurrentJob, getJob, saveJob } from "@/storage/jobStore";
import { getSettings, saveSettings } from "@/storage/settingsStore";
import type { CourseSummary, ExtensionMessage } from "@/types";
import { ArchivePipeline } from "./pipeline";
import { broadcastMessage, sendToTab } from "./tabMessaging";

let activePipeline: ArchivePipeline | null = null;

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Skool Archiver background error", error);
      sendResponse({ type: "ERROR", message: errorMessage });
    });
  return true;
});

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case "SCAN_COURSE_REQUEST": {
      const tabId = sender.tab?.id ?? (await getActiveTabId());
      if (!tabId) throw new Error("No active Skool tab found");
      return sendToTab(tabId, { type: "SCAN_COURSE_REQUEST" });
    }

    case "START_ARCHIVE": {
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("No active Skool tab found");
      const scan = await sendToTab<{ type: "SCAN_COURSE_RESULT"; course: CourseSummary }>(tabId, {
        type: "SCAN_COURSE_REQUEST"
      });
      const settings = await getSettings();
      activePipeline = new ArchivePipeline(scan.course, tabId, settings);
      await saveJob(activePipeline.job);
      void activePipeline.run().catch((error: unknown) => {
        broadcastMessage({ type: "JOB_STATE_UPDATE", job: activePipeline!.job });
        console.error("Archive pipeline failed", error);
      });
      return { type: "JOB_STATE_UPDATE", job: activePipeline.job };
    }

    case "CANCEL_ARCHIVE": {
      activePipeline?.cancel();
      return { ok: true };
    }

    case "GET_JOB_STATE": {
      const job = message.jobId ? await getJob(message.jobId) : await getCurrentJob();
      return { type: "JOB_STATE_UPDATE", job };
    }

    case "GET_SETTINGS": {
      const settings = await getSettings();
      return { type: "SETTINGS_RESULT", settings };
    }

    case "UPDATE_SETTINGS": {
      await saveSettings(message.settings);
      return { type: "SETTINGS_RESULT", settings: message.settings };
    }

    default:
      return { ok: true };
  }
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

/** If the browser (or the service worker) was closed mid-archive, resume the
 *  last in-progress job automatically instead of starting over: already
 *  completed lessons are read from the IndexedDB cache and skipped. */
async function resumeInterruptedJob(): Promise<void> {
  const job = await getCurrentJob();
  if (!job || job.phase === "done" || job.phase === "error") return;

  const tabId = await getActiveTabId();
  if (!tabId) {
    console.info(`Skool Archiver: job ${job.id} is resumable once a Skool tab is open.`);
    return;
  }

  const settings = await getSettings();
  activePipeline = new ArchivePipeline(job.course, tabId, settings, job);
  broadcastMessage({ type: "JOB_STATE_UPDATE", job: activePipeline.job });
  void activePipeline.run().catch((error: unknown) => {
    console.error("Resumed archive pipeline failed", error);
  });
}

chrome.runtime.onStartup.addListener(() => {
  void resumeInterruptedJob();
});

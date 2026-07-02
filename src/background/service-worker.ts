import { getCurrentJob, getJob, saveJob } from "@/storage/jobStore";
import { getSettings, saveSettings } from "@/storage/settingsStore";
import type { CourseSummary, ExtensionMessage } from "@/types";
import { scanSkoolCourse } from "./moduleScanner";
import { ArchivePipeline } from "./pipeline";
import { broadcastMessage } from "./tabMessaging";

let activePipeline: ArchivePipeline | null = null;

/** The scan drives the tab through several click+navigate cycles over many
 *  seconds. The popup can close mid-scan (it's just a transient UI) without
 *  stopping it, so if the user reopens the popup and hits Scan again, a
 *  second scan would race the first one on the same tab and corrupt both.
 *  Reusing the in-flight promise instead makes a repeat request just wait
 *  for the scan that's already running. */
let scanInFlight: Promise<CourseSummary> | null = null;

async function scanCourseOnce(tabId: number, rootUrl: string): Promise<CourseSummary> {
  if (scanInFlight) return scanInFlight;
  scanInFlight = scanSkoolCourse(tabId, rootUrl).finally(() => {
    scanInFlight = null;
  });
  return scanInFlight;
}

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
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url) throw new Error("Could not read the current tab's URL");
      const course = await scanCourseOnce(tabId, tab.url);
      return { type: "SCAN_COURSE_RESULT", course };
    }

    case "START_ARCHIVE": {
      if (isPipelineActive()) {
        throw new Error("An archive is already in progress — wait for it to finish or cancel it first.");
      }

      const tabId = await getActiveTabId();
      if (!tabId) throw new Error("No active Skool tab found");
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url) throw new Error("Could not read the current tab's URL");
      const fullCourse = await scanCourseOnce(tabId, tab.url);
      const course = message.moduleId ? filterCourseToModule(fullCourse, message.moduleId) : fullCourse;

      const settings = await getSettings();
      activePipeline = new ArchivePipeline(course, tabId, settings);
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

function isPipelineActive(): boolean {
  if (!activePipeline) return false;
  const phase = activePipeline.job.phase;
  return phase !== "done" && phase !== "error" && phase !== "idle";
}

/** Narrows a full course scan down to a single module, for "archive just
 *  this classroom" instead of the whole course. */
function filterCourseToModule(course: CourseSummary, moduleId: string): CourseSummary {
  const module = course.modules.find((m) => m.id === moduleId);
  if (!module) throw new Error("That module could not be found — try scanning again.");
  return { ...course, modules: [module] };
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

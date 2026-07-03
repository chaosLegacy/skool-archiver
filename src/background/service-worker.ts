import { getCurrentJob, getJob, saveJob } from "@/storage/jobStore";
import { getScanState, saveScanState } from "@/storage/scanStore";
import { getSettings, saveSettings } from "@/storage/settingsStore";
import type { CourseSummary, ExtensionMessage, ScanState } from "@/types";
import { scanSkoolCourse } from "./moduleScanner";
import { packageAndDownloadJob } from "./packaging";
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

/** Persists + broadcasts scan progress so a popup that was closed (or never
 *  open) partway through a scan can pick up exactly where things stand
 *  instead of looking idle until the user starts an entirely new scan. */
async function setScanState(scan: ScanState): Promise<void> {
  await saveScanState(scan);
  broadcastMessage({ type: "SCAN_STATE_UPDATE", scan });
}

async function scanCourseOnce(tabId: number, rootUrl: string): Promise<CourseSummary> {
  if (scanInFlight) return scanInFlight;
  void setScanState({ status: "scanning" });
  scanInFlight = scanSkoolCourse(tabId, rootUrl)
    .then(async (course) => {
      await setScanState({ status: "scanned", course });
      return course;
    })
    .catch(async (error: unknown) => {
      await setScanState({
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    })
    .finally(() => {
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
      // Reuse a course from a scan that already finished (possibly in a
      // popup that's since closed) rather than repeating the whole
      // click-through discovery — the user already waited for that once.
      const priorScan = await getScanState();
      const course =
        priorScan.status === "scanned" ? priorScan.course : await scanCourseOnce(tabId, tab.url);
      await setScanState({ status: "idle" }); // consumed — extraction progress takes over now

      // Resume the existing job (e.g. after a cancelled/partial extraction)
      // instead of starting a new one — a fresh job id would miss the
      // already-cached lessons entirely, since the cache is keyed by job id.
      const existingJob = await getCurrentJob();
      const resumable = existingJob?.courseId === course.id ? existingJob : undefined;

      const settings = await getSettings();
      activePipeline = new ArchivePipeline(course, tabId, settings, resumable);
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

    case "DOWNLOAD_ARCHIVE": {
      await packageAndDownloadJob(message.jobId, message.moduleId);
      const job = await getJob(message.jobId);
      return { type: "JOB_STATE_UPDATE", job };
    }

    case "GET_JOB_STATE": {
      const job = message.jobId ? await getJob(message.jobId) : await getCurrentJob();
      return { type: "JOB_STATE_UPDATE", job };
    }

    case "GET_SCAN_STATE": {
      const scan = await getScanState();
      return { type: "SCAN_STATE_UPDATE", scan };
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

const INACTIVE_PHASES = new Set(["done", "error", "idle", "extracted"]);

function isPipelineActive(): boolean {
  if (!activePipeline) return false;
  return !INACTIVE_PHASES.has(activePipeline.job.phase);
}

/** If the browser (or the service worker) was closed mid-extraction, resume
 *  the last in-progress job automatically instead of starting over: already
 *  completed lessons are read from the IndexedDB cache and skipped. A job
 *  that already reached "extracted" needs no resuming — it's just waiting
 *  for the user to choose what to download. */
async function resumeInterruptedJob(): Promise<void> {
  const job = await getCurrentJob();
  if (!job || INACTIVE_PHASES.has(job.phase)) return;

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

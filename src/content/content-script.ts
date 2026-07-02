import { getExtractorForUrl } from "@/extractors";
import { findModuleEntries, getModuleEntryPosition, waitThenScanAllLessons } from "@/extractors/skool/scanner";
import type { ExtensionMessage, ExtractedLesson } from "@/types";

const extractor = getExtractorForUrl(window.location.href);

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionMessage) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Skool Archiver content script error", error);
        sendResponse({ type: "ERROR", message: errorMessage });
      });
    return true;
  }
);

async function handleMessage(message: ExtensionMessage): Promise<ExtensionMessage> {
  switch (message.type) {
    case "DETECT_SKOOL":
      return {
        type: "DETECT_SKOOL",
        result: {
          isSkool: extractor !== null,
          isClassroom: extractor?.isClassroomPage() ?? false
        }
      };

    case "GET_MODULE_ENTRIES":
      return { type: "MODULE_ENTRIES_RESULT", entries: findModuleEntries() };

    case "GET_MODULE_ENTRY_POSITION": {
      const position = await getModuleEntryPosition(message.index);
      return { type: "MODULE_ENTRY_POSITION_RESULT", ...position };
    }

    case "SCAN_VISIBLE_LESSONS_REQUEST": {
      // If a click causes a real page navigation, this script instance (and
      // this whole poll) gets torn down mid-flight — the background caller
      // handles that by falling back to a fresh request once the new page's
      // content script has settled.
      const lessons = await waitThenScanAllLessons();
      return { type: "VISIBLE_LESSONS_RESULT", lessons };
    }

    case "EXTRACT_LESSON_REQUEST": {
      if (!extractor) throw new Error("This page is not a Skool classroom.");
      const lesson: ExtractedLesson = await extractor.extractCurrentLesson(message.lesson);
      return { type: "EXTRACT_LESSON_RESULT", lesson };
    }

    default:
      return { type: "PING" };
  }
}

import { getExtractorForUrl } from "@/extractors";
import type { ExtensionMessage, ExtractedLesson } from "@/types";

const extractor = getExtractorForUrl(window.location.href);

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionMessage) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        console.error("Skool Archiver content script error", error);
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

    case "SCAN_COURSE_REQUEST": {
      if (!extractor) throw new Error("This page is not a Skool classroom.");
      const course = await extractor.scanCourse();
      if (!course) throw new Error("Could not find any modules/lessons on this page.");
      return { type: "SCAN_COURSE_RESULT", course };
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

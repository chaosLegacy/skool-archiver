export type ExportFormat = "pdf" | "html" | "markdown" | "json";

export type VideoProvider = "youtube" | "vimeo" | "loom" | "wistia" | "html5" | "unknown";

export interface VideoRef {
  provider: VideoProvider;
  /** Playable/source URL when directly accessible; undefined if DRM/protected. */
  sourceUrl?: string;
  embedUrl?: string;
  title?: string;
  thumbnailUrl?: string;
  /** Populated once the (non-video) preview thumbnail image is downloaded,
   *  relative path inside the archive. This is just a still preview picture,
   *  never the protected video stream itself. */
  thumbnailLocalPath?: string;
  /** True when the extension determined the stream cannot be saved without bypassing protections. */
  protected: boolean;
  reason?: string;
}

export interface ImageRef {
  originalUrl: string;
  alt?: string;
  /** Populated once downloaded, relative path inside the archive. */
  localPath?: string;
}

export interface LinkRef {
  href: string;
  text: string;
}

export interface TableRef {
  headers: string[];
  rows: string[][];
}

export interface CodeBlockRef {
  language?: string;
  code: string;
}

export interface QuoteRef {
  text: string;
  author?: string;
}

export interface AttachmentRef {
  name: string;
  url: string;
  localPath?: string;
}

/** Ordered content block so exporters can render body content in original document order. */
export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; ref: ImageRef }
  | { type: "table"; ref: TableRef }
  | { type: "code"; ref: CodeBlockRef }
  | { type: "quote"; ref: QuoteRef }
  | { type: "video"; ref: VideoRef };

export interface LessonMeta {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  publishDate?: string;
  url: string;
  moduleId: string;
  moduleTitle: string;
  order: number;
}

export interface ExtractedLesson extends LessonMeta {
  blocks: ContentBlock[];
  images: ImageRef[];
  videos: VideoRef[];
  links: LinkRef[];
  attachments: AttachmentRef[];
}

export interface ModuleSummary {
  id: string;
  title: string;
  order: number;
  lessons: LessonMeta[];
}

export interface CourseSummary {
  id: string;
  title: string;
  url: string;
  modules: ModuleSummary[];
}

export type LessonStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export interface LessonJobState {
  lessonId: string;
  status: LessonStatus;
  attempts: number;
  error?: string;
}

export type JobPhase =
  | "idle"
  | "scanning"
  | "extracting"
  | "generating_pdf"
  | "downloading_videos"
  | "downloading_images"
  // Every lesson has been extracted and cached, but nothing has been zipped
  // or downloaded yet — the user picks "download all" or a specific
  // classroom next, and packaging only happens then (see
  // background/packaging.ts). Lets the same extraction be packaged more
  // than once (e.g. the whole course, then later just one classroom) without
  // re-extracting anything.
  | "extracted"
  | "packaging"
  | "done"
  | "error";

export interface ArchiveJobState {
  id: string;
  courseId: string;
  courseTitle: string;
  course: CourseSummary;
  phase: JobPhase;
  createdAt: number;
  updatedAt: number;
  totalLessons: number;
  lessons: Record<string, LessonJobState>;
  startTime: number;
  estimatedRemainingMs?: number;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
}

export interface ArchiveSettings {
  exportFormats: Record<ExportFormat, boolean>;
  downloadImages: boolean;
  downloadVideos: boolean;
  maxParallelDownloads: number;
  filenameFormat: string; // template, e.g. "{order}-{title}"
  theme: "light" | "dark" | "system";
}

export const DEFAULT_SETTINGS: ArchiveSettings = {
  exportFormats: { pdf: true, html: false, markdown: false, json: false },
  downloadImages: true,
  downloadVideos: true,
  maxParallelDownloads: 3,
  filenameFormat: "{order}-{title}",
  theme: "system"
};

/**
 * Scanning drives the tab through several click+navigate cycles over many
 * seconds in the background — the popup is free to close mid-scan (it's
 * just a transient UI) without stopping it. Persisting this (see
 * storage/scanStore.ts) and broadcasting it as it changes is what lets a
 * freshly-reopened popup show the right thing immediately, instead of
 * looking idle until the user starts an entirely new scan.
 */
export type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "scanned"; course: CourseSummary }
  | { status: "error"; message: string };

export interface ArchiveMetadata {
  courseTitle: string;
  exportDate: string;
  moduleCount: number;
  lessonCount: number;
  imageCount: number;
  videoCount: number;
  pdfCount: number;
  version: string;
}

/** Messages exchanged between content script, background, popup, and options. */
export type ExtensionMessage =
  | { type: "PING" }
  | { type: "ERROR"; message: string }
  | { type: "DETECT_SKOOL"; result?: { isSkool: boolean; isClassroom: boolean } }
  | { type: "SCAN_COURSE_REQUEST" }
  | { type: "SCAN_COURSE_RESULT"; course: CourseSummary }
  | { type: "GET_SCAN_STATE" }
  | { type: "SCAN_STATE_UPDATE"; scan: ScanState }
  // Low-level steps used by the background orchestrator to discover modules
  // that only exist as click-driven (hrefless) cards on the classroom root
  // page — see background/moduleScanner.ts.
  | { type: "GET_MODULE_ENTRIES" }
  | { type: "MODULE_ENTRIES_RESULT"; entries: { index: number; title: string }[] }
  | { type: "GET_MODULE_ENTRY_POSITION"; index: number }
  | { type: "MODULE_ENTRY_POSITION_RESULT"; x: number; y: number }
  | { type: "SCAN_VISIBLE_LESSONS_REQUEST" }
  | {
      type: "VISIBLE_LESSONS_RESULT";
      lessons: { title: string; url: string }[];
    }
  | { type: "EXTRACT_LESSON_REQUEST"; lesson: LessonMeta }
  | { type: "EXTRACT_LESSON_RESULT"; lesson: ExtractedLesson }
  | { type: "START_ARCHIVE"; courseId: string }
  | { type: "CANCEL_ARCHIVE"; jobId: string }
  // Sent once a job has reached the "extracted" phase — builds and
  // downloads a zip from already-cached lessons, either the whole course
  // (no moduleId) or just one classroom. Can be sent more than once for the
  // same job.
  | { type: "DOWNLOAD_ARCHIVE"; jobId: string; moduleId?: string }
  // Service workers have no URL.createObjectURL — the background asks the
  // offscreen document (a hidden page with a real DOM) to save the data via
  // chrome.downloads instead. See offscreen/offscreen.ts. This carries raw
  // bytes rather than a Blob: a Blob constructed in one context doesn't
  // survive chrome.runtime.sendMessage's serialization as a real Blob on the
  // other end, and URL.createObjectURL then throws "Overload resolution
  // failed" on it — a Uint8Array clones correctly, so the offscreen document
  // constructs its own genuine Blob from it instead.
  | {
      type: "SAVE_BLOB_TO_DOWNLOADS_REQUEST";
      bytes: Uint8Array;
      mimeType: string;
      filename: string;
      conflictAction?: chrome.downloads.FilenameConflictAction;
    }
  | { type: "SAVE_BLOB_TO_DOWNLOADS_RESULT"; downloadId: number; filename: string }
  | { type: "JOB_STATE_UPDATE"; job?: ArchiveJobState }
  | { type: "GET_JOB_STATE"; jobId: string }
  | { type: "GET_SETTINGS" }
  | { type: "SETTINGS_RESULT"; settings: ArchiveSettings }
  | { type: "UPDATE_SETTINGS"; settings: ArchiveSettings };

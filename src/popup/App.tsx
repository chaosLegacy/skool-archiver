import { useEffect, useState, type ReactNode } from "react";
import type { ArchiveJobState, CourseSummary, ExtensionMessage } from "@/types";
import { onRuntimeMessage, sendRuntimeMessage } from "@/utils/messaging";
import { formatDuration } from "@/utils/time";

type PageStatus = "checking" | "not-skool" | "not-classroom" | "ready";

export default function App() {
  const [status, setStatus] = useState<PageStatus>("checking");
  const [course, setCourse] = useState<CourseSummary | null>(null);
  const [job, setJob] = useState<ArchiveJobState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    detectPage();
    sendRuntimeMessage<{ type: "JOB_STATE_UPDATE"; job?: ArchiveJobState }>({
      type: "GET_JOB_STATE",
      jobId: ""
    }).then((res) => res.job && setJob(res.job));

    return onRuntimeMessage((message: ExtensionMessage) => {
      if (message.type === "JOB_STATE_UPDATE" && message.job) setJob(message.job);
    });
  }, []);

  async function detectPage(): Promise<void> {
    setStatus("checking");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus("not-skool");
      return;
    }
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_SKOOL" } satisfies ExtensionMessage);
      if (!response?.result?.isSkool) setStatus("not-skool");
      else if (!response.result.isClassroom) setStatus("not-classroom");
      else setStatus("ready");
    } catch {
      setStatus("not-skool");
    }
  }

  async function scanCourse(): Promise<void> {
    setScanning(true);
    setError(null);
    try {
      const res = await sendRuntimeMessage<{ type: "SCAN_COURSE_RESULT"; course: CourseSummary }>({
        type: "SCAN_COURSE_REQUEST"
      });
      setCourse(res.course);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  async function startArchive(moduleId?: string): Promise<void> {
    setError(null);
    setStarting(true);
    try {
      const res = await sendRuntimeMessage<{ type: "JOB_STATE_UPDATE"; job: ArchiveJobState }>({
        type: "START_ARCHIVE",
        courseId: course?.id ?? "",
        moduleId
      });
      setJob(res.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  async function cancelArchive(): Promise<void> {
    if (!job) return;
    await sendRuntimeMessage({ type: "CANCEL_ARCHIVE", jobId: job.id });
  }

  const lessonCount = course?.modules.reduce((sum, m) => sum + m.lessons.length, 0) ?? 0;

  return (
    <div className="flex flex-col gap-3 p-4">
      <Header />

      {status === "checking" && <InfoBox>Checking this page…</InfoBox>}
      {status === "not-skool" && <InfoBox tone="warn">This page is not a Skool classroom.</InfoBox>}
      {status === "not-classroom" && (
        <InfoBox tone="warn">Open a classroom page on Skool to scan lessons.</InfoBox>
      )}

      {status === "ready" && (
        <>
          {!course && (
            <button className="btn-primary" onClick={scanCourse} disabled={scanning}>
              {scanning ? "Scanning…" : "Scan Classroom"}
            </button>
          )}

          {course && !job && (
            <div className="flex flex-col gap-2">
              <CourseSummaryCard title={course.title} moduleCount={course.modules.length} lessonCount={lessonCount} />
              <button className="btn-primary" onClick={() => startArchive()} disabled={starting}>
                {starting ? "Starting…" : "Download All"}
              </button>

              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                or pick one classroom
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
              </div>

              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent px-2 py-1.5 text-sm"
                  value={selectedModuleId}
                  onChange={(e) => setSelectedModuleId(e.target.value)}
                >
                  <option value="">Choose a classroom…</option>
                  {course.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.lessons.length})
                    </option>
                  ))}
                </select>
                <button
                  className="btn-secondary shrink-0"
                  onClick={() => startArchive(selectedModuleId)}
                  disabled={!selectedModuleId || starting}
                >
                  Download
                </button>
              </div>
            </div>
          )}

          {job && <ProgressPanel job={job} onCancel={cancelArchive} />}
        </>
      )}

      {error && <InfoBox tone="error">{error}</InfoBox>}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-base font-semibold">Skool Archiver</h1>
      <button
        className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        onClick={() => chrome.runtime.openOptionsPage()}
      >
        Settings
      </button>
    </div>
  );
}

function InfoBox({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "error" }) {
  const colors = {
    info: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    warn: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    error: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
  }[tone];
  return <div className={`rounded-md px-3 py-2 text-sm ${colors}`}>{children}</div>;
}

function CourseSummaryCard({
  title,
  moduleCount,
  lessonCount
}: {
  title: string;
  moduleCount: number;
  lessonCount: number;
}) {
  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-700 p-3">
      <div className="font-medium">{title}</div>
      <div className="text-xs text-neutral-500 mt-1">
        {moduleCount} modules · {lessonCount} lessons
      </div>
    </div>
  );
}

function ProgressPanel({ job, onCancel }: { job: ArchiveJobState; onCancel: () => void }) {
  const lessons = Object.values(job.lessons);
  const completed = lessons.filter((l) => l.status === "completed").length;
  const failed = lessons.filter((l) => l.status === "failed").length;
  const total = job.totalLessons;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium capitalize">{job.phase.replace(/_/g, " ")}</div>
      <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-neutral-500 flex justify-between">
        <span>
          {completed}/{total} lessons{failed ? ` · ${failed} failed` : ""}
        </span>
        {job.estimatedRemainingMs !== undefined && <span>~{formatDuration(job.estimatedRemainingMs)} left</span>}
      </div>

      {job.phase !== "done" && (
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      )}

      <LogsPanel logs={job.logs} />
    </div>
  );
}

function LogsPanel({ logs }: { logs: ArchiveJobState["logs"] }) {
  const recent = logs.slice(-20).reverse();
  return (
    <div className="mt-1 max-h-40 overflow-y-auto rounded-md bg-neutral-50 dark:bg-neutral-800 p-2 text-xs font-mono">
      {recent.length === 0 && <div className="text-neutral-400">No logs yet.</div>}
      {recent.map((entry, i) => (
        <div
          key={i}
          className={
            entry.level === "error"
              ? "text-red-600 dark:text-red-400"
              : entry.level === "warn"
                ? "text-amber-600 dark:text-amber-400"
                : "text-neutral-600 dark:text-neutral-300"
          }
        >
          {entry.message}
        </div>
      ))}
    </div>
  );
}

import type { ArchiveJobState } from "@/types";

const JOB_PREFIX = "job:";
const CURRENT_JOB_KEY = "currentJobId";

function jobKey(jobId: string): string {
  return `${JOB_PREFIX}${jobId}`;
}

export async function saveJob(job: ArchiveJobState): Promise<void> {
  await chrome.storage.local.set({ [jobKey(job.id)]: job, [CURRENT_JOB_KEY]: job.id });
}

export async function getJob(jobId: string): Promise<ArchiveJobState | undefined> {
  const stored = await chrome.storage.local.get(jobKey(jobId));
  return stored[jobKey(jobId)] as ArchiveJobState | undefined;
}

export async function getCurrentJobId(): Promise<string | undefined> {
  const stored = await chrome.storage.local.get(CURRENT_JOB_KEY);
  return stored[CURRENT_JOB_KEY] as string | undefined;
}

export async function getCurrentJob(): Promise<ArchiveJobState | undefined> {
  const jobId = await getCurrentJobId();
  if (!jobId) return undefined;
  return getJob(jobId);
}

export async function deleteJob(jobId: string): Promise<void> {
  await chrome.storage.local.remove(jobKey(jobId));
}

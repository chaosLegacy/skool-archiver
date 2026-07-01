export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "--";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function estimateRemainingMs(
  startTime: number,
  completed: number,
  total: number
): number | undefined {
  if (completed <= 0 || total <= 0) return undefined;
  const elapsed = Date.now() - startTime;
  const perItem = elapsed / completed;
  return Math.max(0, Math.round(perItem * (total - completed)));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

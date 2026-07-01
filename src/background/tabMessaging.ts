import { sleep } from "@/utils/time";
import type { ExtensionMessage } from "@/types";

function sendOnce<T extends ExtensionMessage>(
  tabId: number,
  message: ExtensionMessage,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for a response from the page. Try reloading the tab."));
    }, timeoutMs);

    chrome.tabs.sendMessage(tabId, message, (response: ExtensionMessage) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.type === "ERROR") {
        reject(new Error(response.message));
        return;
      }
      resolve(response as T);
    });
  });
}

const NO_RECEIVER_ERROR = /Receiving end does not exist|Could not establish connection/i;

/** Right after a navigation, `tabs.onUpdated` can report `status: complete`
 *  slightly before a freshly-injected content script has registered its
 *  message listener — the first send lands in that gap and Chrome reports
 *  it as "Could not establish connection" rather than queuing it. Retrying
 *  a few times with a short delay rides out that race instead of failing
 *  the whole lesson over a timing fluke. */
export async function sendToTab<T extends ExtensionMessage>(
  tabId: number,
  message: ExtensionMessage,
  timeoutMs = 30000,
  retries = 5,
  retryDelayMs = 400
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await sendOnce<T>(tabId, message, timeoutMs);
    } catch (error) {
      lastError = error;
      const isNoReceiver = error instanceof Error && NO_RECEIVER_ERROR.test(error.message);
      if (!isNoReceiver || attempt === retries) throw error;
      await sleep(retryDelayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to message tab");
}

export function waitForTabComplete(tabId: number, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for page load"));
    }, timeoutMs);

    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

export function navigateTab(tabId: number, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { url }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

export function broadcastMessage(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    /* no listener (e.g. popup closed) — safe to ignore */
  });
}

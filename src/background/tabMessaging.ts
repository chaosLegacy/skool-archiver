import type { ExtensionMessage } from "@/types";

export function sendToTab<T extends ExtensionMessage>(
  tabId: number,
  message: ExtensionMessage,
  timeoutMs = 30000
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

import type { ExtensionMessage } from "@/types";

export function sendRuntimeMessage<T extends ExtensionMessage>(
  message: ExtensionMessage
): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export function onRuntimeMessage(
  callback: (message: ExtensionMessage) => void
): () => void {
  const listener = (message: ExtensionMessage) => callback(message);
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

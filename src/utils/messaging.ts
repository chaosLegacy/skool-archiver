import type { ExtensionMessage } from "@/types";

export async function sendRuntimeMessage<T extends ExtensionMessage>(
  message: ExtensionMessage
): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as ExtensionMessage | undefined;
  if (response?.type === "ERROR") {
    throw new Error(response.message);
  }
  return response as T;
}

export function onRuntimeMessage(
  callback: (message: ExtensionMessage) => void
): () => void {
  const listener = (message: ExtensionMessage) => callback(message);
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

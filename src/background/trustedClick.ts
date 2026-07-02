/**
 * Skool's classroom module cards are react-beautiful-dnd draggables. RBD
 * (and libraries like it) run their own mousedown/mouseup timing logic to
 * tell a click apart from a drag, and in practice its "click" handling is
 * unreliable for anything that isn't a genuinely trusted, OS-level input
 * event — plain `element.click()` or dispatching synthetic MouseEvents from
 * the page often does nothing (a known class of issue for this library).
 *
 * The Chrome DevTools Protocol's Input domain, reachable via chrome.debugger,
 * dispatches events the same way a real user's click would — indistinguishable
 * from genuine input, which is exactly what Puppeteer/Playwright use under
 * the hood for their own `.click()`. Attaching shows Chrome's "started
 * debugging this browser" banner for as long as the session is open; the
 * scan attaches once and detaches when done rather than per click.
 */

async function withDebuggerApi<T>(
  run: (resolve: (value: T) => void, reject: (reason: unknown) => void) => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    run(resolve, reject);
  });
}

export function attachDebugger(tabId: number): Promise<void> {
  return withDebuggerApi<void>((resolve, reject) => {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

export function detachDebugger(tabId: number): Promise<void> {
  return withDebuggerApi<void>((resolve) => {
    chrome.debugger.detach({ tabId }, () => {
      // Ignore errors on detach (e.g. already detached because the tab
      // navigated) — there's nothing useful to recover from here.
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

function sendCommand(
  tabId: number,
  method: string,
  params: Record<string, unknown>
): Promise<void> {
  return withDebuggerApi<void>((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

/** Dispatches a trusted click at the given viewport coordinates. Assumes the
 *  debugger is already attached to this tab (see attachDebugger). */
export async function dispatchTrustedClick(tabId: number, x: number, y: number): Promise<void> {
  await sendCommand(tabId, "Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none"
  });
  await sendCommand(tabId, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1
  });
  await sendCommand(tabId, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1
  });
}

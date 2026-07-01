export function queryAll<T extends Element = Element>(
  root: ParentNode,
  selector: string
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? "").trim().replace(/\s+/g, " ");
}

export function attrOf(el: Element | null | undefined, attr: string): string | undefined {
  return el?.getAttribute(attr) ?? undefined;
}

export function toAbsoluteUrl(url: string, base = window.location.href): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

export async function waitForElement(
  selector: string,
  timeoutMs = 8000,
  root: ParentNode = document
): Promise<Element | null> {
  const existing = root.querySelector(selector);
  if (existing) return existing;

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const found = root.querySelector(selector);
      if (found) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(found);
      }
    });
    observer.observe(root === document ? document.body : (root as Node), {
      childList: true,
      subtree: true
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(root.querySelector(selector));
    }, timeoutMs);
  });
}

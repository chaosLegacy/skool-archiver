import type { CodeBlockRef } from "@/types";
import { attrOf } from "@/utils/dom";

export function extractCodeBlock(pre: HTMLPreElement): CodeBlockRef {
  const codeEl = pre.querySelector("code") ?? pre;
  const classAttr = attrOf(codeEl, "class") ?? "";
  const languageMatch = classAttr.match(/language-(\w+)/) ?? classAttr.match(/lang-(\w+)/);
  return {
    language: languageMatch?.[1],
    code: codeEl.textContent ?? ""
  };
}

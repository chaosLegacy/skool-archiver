import type { AttachmentRef, LinkRef } from "@/types";
import { attrOf, textOf, toAbsoluteUrl } from "@/utils/dom";

const ATTACHMENT_EXTENSIONS = /\.(pdf|zip|docx?|xlsx?|pptx?|csv|txt|rar|7z)$/i;

export function extractLink(a: HTMLAnchorElement): LinkRef | null {
  const href = attrOf(a, "href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return null;
  return { href: toAbsoluteUrl(href), text: textOf(a) || href };
}

export function isAttachmentLink(a: HTMLAnchorElement): boolean {
  const href = attrOf(a, "href") ?? "";
  return ATTACHMENT_EXTENSIONS.test(href) || a.hasAttribute("download");
}

export function extractAttachment(a: HTMLAnchorElement): AttachmentRef | null {
  const href = attrOf(a, "href");
  if (!href) return null;
  const url = toAbsoluteUrl(href);
  const name = attrOf(a, "download") || url.split("/").pop() || textOf(a) || "attachment";
  return { name, url };
}

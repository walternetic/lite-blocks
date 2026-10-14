import { useSyncExternalStore } from 'react';
import { resolveCrossWorkspaceLink } from './workspaceStorage';
import type { NoteBlock } from '../types/note';

export interface LocalClipboardItem {
  text: string;
  html?: string;
  timestamp: number;
  block?: Partial<NoteBlock>;
}

const LOCAL_CLIPBOARD_STORAGE_KEY = 'liteblocks_local_clipboard';

let inMemoryClipboard: LocalClipboardItem | null = null;
const clipboardListeners = new Set<() => void>();

function notifyClipboardListeners(): void {
  clipboardListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in local clipboard listener:', e);
    }
  });
}

function readStoredLocalClipboard(): LocalClipboardItem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_CLIPBOARD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (typeof parsed.text === 'string' || parsed.block)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read local clipboard from localStorage:', err);
  }
  return null;
}

inMemoryClipboard = readStoredLocalClipboard();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_CLIPBOARD_STORAGE_KEY) {
      inMemoryClipboard = readStoredLocalClipboard();
      notifyClipboardListeners();
    }
  });
}

/**
 * Retrieve the current local clipboard item.
 */
export function getLocalClipboard(): LocalClipboardItem | null {
  return inMemoryClipboard;
}

/**
 * Returns true if the local clipboard currently has non-empty text content or a copied block.
 */
export function hasLocalClipboard(): boolean {
  if (!inMemoryClipboard) return false;
  if (inMemoryClipboard.block) return true;
  return Boolean(inMemoryClipboard.text && inMemoryClipboard.text.trim().length > 0);
}

/**
 * Store text, optional HTML, and optional block metadata into the local clipboard,
 * persisting to localStorage and notifying subscribers.
 */
export function setLocalClipboard(
  data: string | { text: string; html?: string; block?: Partial<NoteBlock> }
): void {
  const item: LocalClipboardItem =
    typeof data === 'string'
      ? { text: data, timestamp: Date.now() }
      : { text: data.text, html: data.html, block: data.block, timestamp: Date.now() };

  inMemoryClipboard = item;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_CLIPBOARD_STORAGE_KEY, JSON.stringify(item));
    }
  } catch (err) {
    console.error('Failed to write local clipboard to localStorage:', err);
  }
  notifyClipboardListeners();
}

/**
 * Clear the local clipboard.
 */
export function clearLocalClipboard(): void {
  inMemoryClipboard = null;
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_CLIPBOARD_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to clear local clipboard from localStorage:', err);
  }
  notifyClipboardListeners();
}

/**
 * Subscribe to local clipboard state changes.
 */
export function subscribeLocalClipboard(listener: () => void): () => void {
  clipboardListeners.add(listener);
  return () => {
    clipboardListeners.delete(listener);
  };
}

/**
 * React hook to reactively subscribe to local clipboard updates.
 */
export function useLocalClipboard(): {
  clipboard: LocalClipboardItem | null;
  hasContent: boolean;
  setClipboard: typeof setLocalClipboard;
  clearClipboard: typeof clearLocalClipboard;
} {
  const snapshot = useSyncExternalStore(
    subscribeLocalClipboard,
    getLocalClipboard,
    () => null
  );

  return {
    clipboard: snapshot,
    hasContent: Boolean(
      snapshot &&
        (Boolean(snapshot.block) || (Boolean(snapshot.text) && snapshot.text.trim().length > 0))
    ),
    setClipboard: setLocalClipboard,
    clearClipboard: clearLocalClipboard,
  };
}

// Escape HTML utility functions
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Global tracker for Shift+Paste (Ctrl+Shift+V or Cmd+Shift+V)
let lastShiftPasteTimestamp = 0;

if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        lastShiftPasteTimestamp = Date.now();
      }
    },
    true // Capture phase to ensure detection before paste event
  );
}

/**
 * Returns true if a Shift+Paste shortcut was activated recently (< 300ms)
 */
export function isShiftPasteActive(): boolean {
  return Date.now() - lastShiftPasteTimestamp < 300;
}

/**
 * Serialize plain text (potentially containing wikilinks [[ws/note|label]])
 * simultaneously into two MIME representations:
 * - text/plain: preserved standard wikilink grammar
 * - text/html: rich semantic HTML anchor elements with metadata attributes
 */
export function buildMultiMimeClipboard(plainText: string): { plain: string; html: string } {
  // Convert wikilink patterns [[ws/note|label]], [[ws/note]], or [[ws]] to semantic HTML
  const htmlContent = plainText.replace(/\[\[(.*?)\]\]/g, (match, inner) => {
    const full = inner.trim();
    const pipeParts = full.split('|');
    const pathPart = pipeParts[0].trim();
    const customLabel = pipeParts[1]?.trim();

    const slashParts = pathPart.split(/[\/#]/);
    const wsName = slashParts[0]?.trim();
    const noteTitle = slashParts[1]?.trim();

    const link = resolveCrossWorkspaceLink(wsName, noteTitle);
    const label = customLabel || link.noteTitle || link.workspaceName;

    return `<a href="${link.url}" data-liteblocks-link="true" data-workspace="${escapeAttr(link.workspaceName)}" data-note="${escapeAttr(link.noteTitle || '')}" data-label="${escapeAttr(label)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  });

  // Convert lines into formatted HTML spans/breaks
  const formattedHtml = htmlContent
    .split('\n')
    .map((line) => (line ? `<span>${line}</span>` : '<br/>'))
    .join('');

  return {
    plain: plainText,
    html: formattedHtml,
  };
}

/**
 * Parse pasted clipboard data according to the clipboard contract:
 * - isForcePlain: true when Ctrl+Shift+V is used or only text/plain is available in clipboardData.
 *   Returns literal plain text with zero conversions or link interpretations.
 * - Normal paste (Ctrl+V): if text/html is available and contains hyperlinks,
 *   converts those hyperlinks into native Lite Blocks wikilink components [[workspace/note|label]].
 */
export function parseClipboardPaste(
  clipboardData: DataTransfer | null,
  isForcePlain: boolean
): { text: string; hasConvertedLinks: boolean } {
  if (!clipboardData) {
    return { text: '', hasConvertedLinks: false };
  }

  const plainText = clipboardData.getData('text/plain') || '';

  // Requirement: when pasted as pure text (e.g. Ctrl+Shift+V or text/plain only),
  // force text/plain and interpret as pure text, without conversions or interpretations.
  if (isForcePlain || !clipboardData.types.includes('text/html')) {
    return {
      text: plainText,
      hasConvertedLinks: false,
    };
  }

  const htmlData = clipboardData.getData('text/html') || '';
  if (!htmlData) {
    return { text: plainText, hasConvertedLinks: false };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlData, 'text/html');
    const links = doc.querySelectorAll('a');

    if (links.length === 0) {
      // HTML has no links, fall back to plain text
      return { text: plainText, hasConvertedLinks: false };
    }

    let hasConverted = false;

    links.forEach((a) => {
      const isLiteLink = a.getAttribute('data-liteblocks-link') === 'true';
      const wsName = a.getAttribute('data-workspace');
      const noteTitle = a.getAttribute('data-note');
      const label = a.getAttribute('data-label') || a.textContent?.trim() || '';

      if (isLiteLink && wsName) {
        hasConverted = true;
        const target = noteTitle ? `${wsName}/${noteTitle}` : wsName;
        const tag = label && label !== (noteTitle || wsName) ? `[[${target}|${label}]]` : `[[${target}]]`;
        a.replaceWith(doc.createTextNode(tag));
      } else {
        const href = a.getAttribute('href') || '';
        try {
          // Check if link is an internal Lite Blocks route with ?ws=...&note=...
          const urlObj = new URL(href, window.location.href);
          const qWs = urlObj.searchParams.get('ws');
          const qNote = urlObj.searchParams.get('note');

          if (qWs) {
            hasConverted = true;
            const target = qNote ? `${qWs}/${qNote}` : qWs;
            const tag = label && label !== (qNote || qWs) ? `[[${target}|${label}]]` : `[[${target}]]`;
            a.replaceWith(doc.createTextNode(tag));
            return;
          }
        } catch {
          // Not an absolute or parseable URL
        }

        // Generic web link
        if (href) {
          hasConverted = true;
          const display = label || href;
          a.replaceWith(doc.createTextNode(`[[${href}|${display}]]`));
        }
      }
    });

    const convertedText = doc.body.textContent || plainText;
    return {
      text: convertedText,
      hasConvertedLinks: hasConverted,
    };
  } catch (err) {
    console.error('Failed to parse HTML clipboard payload:', err);
    return { text: plainText, hasConvertedLinks: false };
  }
}

/**
 * Handle copy event for any block or component, ensuring dual MIME registration.
 */
export function handleBlockCopy(
  e: React.ClipboardEvent | ClipboardEvent,
  plainTextToCopy?: string
): void {
  let text = plainTextToCopy;

  if (!text) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const frag = range.cloneContents();
      let plain = '';

      for (const node of Array.from(frag.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          plain += node.textContent || '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const raw = el.getAttribute('data-link-raw') || el.getAttribute('data-raw');
          if (raw) {
            plain += raw;
          } else if (el.nodeName === 'BR') {
            plain += '\n';
          } else {
            plain += el.textContent || '';
          }
        }
      }
      text = plain;
    }
  }

  if (text) {
    e.preventDefault();
    const { plain, html } = buildMultiMimeClipboard(text);
    e.clipboardData?.setData('text/plain', plain);
    e.clipboardData?.setData('text/html', html);
    setLocalClipboard({ text: plain, html });
  }
}

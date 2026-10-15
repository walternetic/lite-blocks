/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Global reusable mirror element for measuring textarea text geometry without reflow overhead
let mirrorDiv: HTMLDivElement | null = null;

const MIRROR_PROPERTIES = [
  'boxSizing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderLeftWidth',
  'borderRightWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textTransform',
  'whiteSpace',
  'wordWrap',
  'wordBreak',
  'tabSize',
  'direction',
] as const;

function getOrCreateMirror(): HTMLDivElement {
  if (!mirrorDiv) {
    mirrorDiv = document.createElement('div');
    mirrorDiv.style.position = 'fixed';
    mirrorDiv.style.top = '-9999px';
    mirrorDiv.style.left = '-9999px';
    mirrorDiv.style.visibility = 'hidden';
    mirrorDiv.style.pointerEvents = 'none';
    mirrorDiv.style.zIndex = '-9999';
    mirrorDiv.style.overflow = 'hidden';
    document.body.appendChild(mirrorDiv);
  }
  return mirrorDiv;
}

function syncMirrorStyles(textarea: HTMLTextAreaElement, mirror: HTMLDivElement) {
  const style = window.getComputedStyle(textarea);
  for (const prop of MIRROR_PROPERTIES) {
    mirror.style[prop as any] = style[prop as any];
  }
  mirror.style.boxSizing = 'border-box';
  mirror.style.width = `${textarea.getBoundingClientRect().width}px`;
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
}

/**
 * Measure caret coordinates (relative to textarea and client viewport) for a given character offset.
 */
export function getTextareaCaretCoordinates(
  textarea: HTMLTextAreaElement,
  charIndex: number
): { left: number; top: number; clientX: number; clientY: number; lineHeight: number } {
  const mirror = getOrCreateMirror();
  syncMirrorStyles(textarea, mirror);

  const text = textarea.value || '';
  const safeIndex = Math.max(0, Math.min(charIndex, text.length));
  const beforeText = text.slice(0, safeIndex);
  const afterText = text.slice(safeIndex);

  mirror.textContent = beforeText;
  const marker = document.createElement('span');
  marker.textContent = afterText.length > 0 ? afterText[0] : '\u200b';
  mirror.appendChild(marker);

  const textareaRect = textarea.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  const relLeft = markerRect.left - mirrorRect.left;
  const relTop = markerRect.top - mirrorRect.top;

  const clientX = textareaRect.left + relLeft - textarea.scrollLeft;
  const clientY = textareaRect.top + relTop - textarea.scrollTop;
  const lineHeight = markerRect.height || parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;

  return {
    left: relLeft,
    top: relTop,
    clientX,
    clientY,
    lineHeight,
  };
}

/**
 * Determine if the cursor in a textarea is positioned on the top-most visual line.
 */
export function isTextareaOnFirstLine(textarea: HTMLTextAreaElement): boolean {
  const selStart = textarea.selectionStart ?? 0;
  const selEnd = textarea.selectionEnd ?? 0;
  if (selStart !== selEnd) return false;

  const { top, lineHeight } = getTextareaCaretCoordinates(textarea, selStart);
  const style = window.getComputedStyle(textarea);
  const paddingTop = parseFloat(style.paddingTop) || 0;

  return top - paddingTop < lineHeight * 0.75;
}

/**
 * Determine if the cursor in a textarea is positioned on the bottom-most visual line.
 */
export function isTextareaOnLastLine(textarea: HTMLTextAreaElement): boolean {
  const selStart = textarea.selectionStart ?? 0;
  const selEnd = textarea.selectionEnd ?? 0;
  if (selStart !== selEnd) return false;

  const text = textarea.value || '';
  const { top, lineHeight } = getTextareaCaretCoordinates(textarea, selStart);
  const { top: endTop } = getTextareaCaretCoordinates(textarea, text.length);

  return Math.abs(endTop - top) < lineHeight * 0.75;
}

/**
 * Find the character index on the first or last line of a textarea closest to a given target clientX.
 */
export function findClosestTextareaIndexForClientX(
  textarea: HTMLTextAreaElement,
  targetClientX: number,
  line: 'first' | 'last'
): number {
  const text = textarea.value || '';
  if (!text) return 0;

  let lineStart = 0;
  let lineEnd = text.length;

  if (line === 'first') {
    const { top: firstLineTop, lineHeight } = getTextareaCaretCoordinates(textarea, 0);
    for (let i = 0; i <= text.length; i++) {
      if (text[i] === '\n') {
        lineEnd = i;
        break;
      }
      const coords = getTextareaCaretCoordinates(textarea, i);
      if (coords.top - firstLineTop > lineHeight * 0.75) {
        lineEnd = Math.max(0, i - 1);
        break;
      }
    }
  } else {
    const { top: lastLineTop, lineHeight } = getTextareaCaretCoordinates(textarea, text.length);
    for (let i = text.length; i >= 0; i--) {
      if (text[i - 1] === '\n') {
        lineStart = i;
        break;
      }
      const coords = getTextareaCaretCoordinates(textarea, i);
      if (lastLineTop - coords.top > lineHeight * 0.75) {
        lineStart = i + 1;
        break;
      }
    }
  }

  // Binary search for closest clientX within [lineStart, lineEnd]
  let bestIndex = lineStart;
  let minDiff = Infinity;
  let low = lineStart;
  let high = lineEnd;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const coords = getTextareaCaretCoordinates(textarea, mid);
    const diff = Math.abs(coords.clientX - targetClientX);

    if (diff < minDiff) {
      minDiff = diff;
      bestIndex = mid;
    }

    if (coords.clientX < targetClientX) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return bestIndex;
}

/**
 * ContentEditable (InlineRichEditor) Caret Coordinate & Boundary Utilities
 */
export function getContentEditableCaretPoint(container: HTMLElement): { clientX: number; clientY: number; top: number; bottom: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  if (rect.width > 0 || rect.height > 0) {
    return { clientX: rect.left, clientY: rect.top, top: rect.top, bottom: rect.bottom };
  }

  // Handle collapsed range with 0-dimension rect (WebKit/Blink edge case)
  const span = document.createElement('span');
  span.textContent = '\u200b';
  const clone = range.cloneRange();
  clone.insertNode(span);
  const spanRect = span.getBoundingClientRect();
  span.parentNode?.removeChild(span);
  sel.removeAllRanges();
  sel.addRange(range);

  return { clientX: spanRect.left, clientY: spanRect.top, top: spanRect.top, bottom: spanRect.bottom };
}

export function isContentEditableOnFirstLine(container: HTMLElement): boolean {
  const point = getContentEditableCaretPoint(container);
  if (!point) return true;
  const containerRect = container.getBoundingClientRect();
  const lineHeight = parseFloat(window.getComputedStyle(container).lineHeight) || 22;
  return point.top - containerRect.top < lineHeight * 0.85;
}

export function isContentEditableOnLastLine(container: HTMLElement): boolean {
  const point = getContentEditableCaretPoint(container);
  if (!point) return true;
  const containerRect = container.getBoundingClientRect();
  const lineHeight = parseFloat(window.getComputedStyle(container).lineHeight) || 22;
  return containerRect.bottom - point.bottom < lineHeight * 0.85;
}

/**
 * Place caret immediately before an element (such as a non-editable atomic badge),
 * prioritizing an adjacent text node if one exists.
 */
function placeCaretBeforeElement(element: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const prev = element.previousSibling;
  if (prev && prev.nodeType === Node.TEXT_NODE) {
    range.setStart(prev, prev.textContent?.length || 0);
  } else {
    range.setStartBefore(element);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Place caret immediately after an element (such as a non-editable atomic badge),
 * prioritizing an adjacent text node if one exists.
 */
function placeCaretAfterElement(element: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const next = element.nextSibling;
  if (next && next.nodeType === Node.TEXT_NODE) {
    range.setStart(next, 0);
  } else {
    range.setStartAfter(element);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function setContentEditableCaretAtClientX(
  container: HTMLElement,
  targetClientX: number,
  line: 'first' | 'last'
): void {
  const containerRect = container.getBoundingClientRect();
  const lineHeight = parseFloat(window.getComputedStyle(container).lineHeight) || 22;
  const targetY = line === 'first' ? containerRect.top + lineHeight * 0.5 : containerRect.bottom - lineHeight * 0.5;

  // 1. Check all atomic non-editable elements (e.g. [[link]] components) inside container
  const atomicElements = Array.from(
    container.querySelectorAll<HTMLElement>('[contenteditable="false"]')
  );

  for (const el of atomicElements) {
    const rect = el.getBoundingClientRect();
    const isLineMatch = line === 'first'
      ? (rect.top - containerRect.top < lineHeight * 0.95)
      : (containerRect.bottom - rect.bottom < lineHeight * 0.95);

    if (isLineMatch && targetClientX >= rect.left && targetClientX <= rect.right) {
      // Treat the atomic component as a single wide character:
      // If cursor is on the left half -> position before; right half -> position after
      const midX = rect.left + rect.width / 2;
      if (targetClientX < midX) {
        placeCaretBeforeElement(el);
      } else {
        placeCaretAfterElement(el);
      }
      return;
    }
  }

  // 2. Query point-to-caret position via standard browser APIs
  let targetNode: Node | null = null;
  let targetOffset = 0;

  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(targetClientX, targetY);
    if (pos && container.contains(pos.offsetNode)) {
      targetNode = pos.offsetNode;
      targetOffset = pos.offset;
    }
  } else if ((document as any).caretRangeFromPoint) {
    const r = (document as any).caretRangeFromPoint(targetClientX, targetY);
    if (r && container.contains(r.startContainer)) {
      targetNode = r.startContainer;
      targetOffset = r.startOffset;
    }
  }

  // 3. If targetNode belongs to a non-editable element or its descendant, reposition outside
  if (targetNode) {
    const atomicEl = (
      targetNode.nodeType === Node.ELEMENT_NODE
        ? (targetNode as HTMLElement)
        : targetNode.parentElement
    )?.closest<HTMLElement>('[contenteditable="false"]');

    if (atomicEl && container.contains(atomicEl)) {
      const rect = atomicEl.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (targetClientX < midX) {
        placeCaretBeforeElement(atomicEl);
      } else {
        placeCaretAfterElement(atomicEl);
      }
      return;
    }

    // Normal editable node
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.setStart(targetNode, targetOffset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
  }

  // 4. Fallback: collapse to start or end of container
  const sel = window.getSelection();
  if (sel) {
    const range = document.createRange();
    range.selectNodeContents(container);
    range.collapse(line === 'first');
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

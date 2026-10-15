import { NoteBlock } from '../types/note';

export interface SelectionPoint {
  blockId: string;
  blockIndex: number;
  offset: number; // Serialized character offset in block.content
  clientX?: number;
}

export interface MultiBlockSelection {
  anchor: SelectionPoint; // Selection origin
  focus: SelectionPoint;  // Active selection extension
}

/**
 * Resolves a serialized character offset to the corresponding DOM Node and node offset
 * inside an InlineRichEditor container.
 */
export function getDomPointFromCharOffset(
  container: HTMLElement,
  targetOffset: number
): { node: Node; offset: number } {
  let current = 0;
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (current + len >= targetOffset) {
        return { node, offset: Math.min(Math.max(0, targetOffset - current), len) };
      }
      current += len;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const raw = el.getAttribute('data-link-raw');
      const len = raw ? raw.length : el.textContent?.length || 0;
      if (current + len >= targetOffset) {
        const mid = current + len / 2;
        if (targetOffset < mid) {
          const prev = el.previousSibling;
          if (prev && prev.nodeType === Node.TEXT_NODE) {
            return { node: prev, offset: prev.textContent?.length || 0 };
          }
          return { node: container, offset: Array.from(container.childNodes).indexOf(el) };
        } else {
          const next = el.nextSibling;
          if (next && next.nodeType === Node.TEXT_NODE) {
            return { node: next, offset: 0 };
          }
          return { node: container, offset: Array.from(container.childNodes).indexOf(el) + 1 };
        }
      }
      current += len;
    }
  }

  // Fallback to end of container
  const last = container.lastChild;
  if (last && last.nodeType === Node.TEXT_NODE) {
    return { node: last, offset: last.textContent?.length || 0 };
  }
  return { node: container, offset: container.childNodes.length };
}

/**
 * Calculates serialized character offset given a DOM node and offset inside container.
 */
export function getCharOffsetFromDomPoint(
  container: HTMLElement,
  node: Node,
  offsetInNode: number
): number {
  if (!container.contains(node) && container !== node) return 0;

  if (node === container) {
    let offset = 0;
    const children = Array.from(container.childNodes);
    for (let i = 0; i < Math.min(offsetInNode, children.length); i++) {
      const child = children[i];
      if (child.nodeType === Node.TEXT_NODE) {
        offset += child.textContent?.length || 0;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const raw = el.getAttribute('data-link-raw');
        offset += raw ? raw.length : el.textContent?.length || 0;
      }
    }
    return offset;
  }

  const range = document.createRange();
  range.selectNodeContents(container);
  try {
    range.setEnd(
      node,
      Math.min(
        offsetInNode,
        node.nodeType === Node.TEXT_NODE ? (node.textContent?.length || 0) : node.childNodes.length
      )
    );
  } catch {
    return 0;
  }

  const fragment = range.cloneContents();
  let totalOffset = 0;
  for (const child of Array.from(fragment.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      totalOffset += child.textContent?.length || 0;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const raw = el.getAttribute('data-link-raw');
      if (raw) {
        totalOffset += raw.length;
      } else if (el.nodeName === 'BR') {
        totalOffset += 1;
      } else {
        totalOffset += el.textContent?.length || 0;
      }
    }
  }
  return totalOffset;
}

/**
 * Computes exact subpixel highlight bounding rects for a multi-block selection
 * using native Range.getClientRects() over DOM nodes.
 */
export function computeMultiBlockSelectionRects(
  canvasEl: HTMLElement,
  blocks: NoteBlock[],
  selection: MultiBlockSelection
): DOMRect[] {
  const canvasRect = canvasEl.getBoundingClientRect();
  const startIdx = Math.min(selection.anchor.blockIndex, selection.focus.blockIndex);
  const endIdx = Math.max(selection.anchor.blockIndex, selection.focus.blockIndex);

  const isForward =
    selection.anchor.blockIndex < selection.focus.blockIndex ||
    (selection.anchor.blockIndex === selection.focus.blockIndex &&
      selection.anchor.offset <= selection.focus.offset);

  const startOffset = isForward ? selection.anchor.offset : selection.focus.offset;
  const endOffset = isForward ? selection.focus.offset : selection.anchor.offset;

  const allRects: DOMRect[] = [];

  for (let i = startIdx; i <= endIdx; i++) {
    const block = blocks[i];
    if (!block) continue;
    if (block.type === 'image' || block.type === 'file') continue;

    const editorEl = canvasEl.querySelector<HTMLElement>(`[data-block-id="${block.id}"]`);
    if (!editorEl) continue;

    const contentLen = block.content?.length || 0;
    let blockStart = 0;
    let blockEnd = contentLen;

    if (i === startIdx) {
      blockStart = startOffset;
    }
    if (i === endIdx) {
      blockEnd = endOffset;
    }

    if (blockStart >= blockEnd && i === startIdx && i === endIdx) {
      continue;
    }

    const startPt = getDomPointFromCharOffset(editorEl, blockStart);
    const endPt = getDomPointFromCharOffset(editorEl, blockEnd);

    try {
      const range = document.createRange();
      range.setStart(startPt.node, startPt.offset);
      range.setEnd(endPt.node, endPt.offset);
      const clientRects = Array.from(range.getClientRects());

      for (const r of clientRects) {
        if (r.width > 0 && r.height > 0) {
          allRects.push(
            new DOMRect(
              r.left - canvasRect.left + canvasEl.scrollLeft,
              r.top - canvasRect.top + canvasEl.scrollTop,
              r.width,
              r.height
            )
          );
        }
      }
    } catch {
      // Ignore range creation errors on transient unmounted nodes
    }
  }

  return allRects;
}

/**
 * Extracts concatenated text (plain and rich HTML) across a multi-block selection.
 */
export function extractMultiBlockText(
  blocks: NoteBlock[],
  selection: MultiBlockSelection
): { plain: string; html: string } {
  const startIdx = Math.min(selection.anchor.blockIndex, selection.focus.blockIndex);
  const endIdx = Math.max(selection.anchor.blockIndex, selection.focus.blockIndex);

  const isForward =
    selection.anchor.blockIndex < selection.focus.blockIndex ||
    (selection.anchor.blockIndex === selection.focus.blockIndex &&
      selection.anchor.offset <= selection.focus.offset);

  const startOffset = isForward ? selection.anchor.offset : selection.focus.offset;
  const endOffset = isForward ? selection.focus.offset : selection.anchor.offset;

  const plainParts: string[] = [];
  const htmlParts: string[] = [];

  for (let i = startIdx; i <= endIdx; i++) {
    const block = blocks[i];
    if (!block) continue;
    if (block.type === 'image' || block.type === 'file') continue;

    const content = block.content || '';
    let slice = content;
    if (i === startIdx && i === endIdx) {
      slice = content.slice(startOffset, endOffset);
    } else if (i === startIdx) {
      slice = content.slice(startOffset);
    } else if (i === endIdx) {
      slice = content.slice(0, endOffset);
    }

    plainParts.push(slice);
    htmlParts.push(`<p>${slice.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`);
  }

  return {
    plain: plainParts.join('\n'),
    html: htmlParts.join(''),
  };
}

/**
 * Performs atomic deletion or replacement of content across a multi-block selection,
 * merging the boundary text of start and end blocks and deleting intermediate blocks.
 */
export function deleteMultiBlockSelection(
  blocks: NoteBlock[],
  selection: MultiBlockSelection,
  replacementText: string = ''
): { newBlocks: NoteBlock[]; targetBlockId: string; targetOffset: number } {
  const startIdx = Math.min(selection.anchor.blockIndex, selection.focus.blockIndex);
  const endIdx = Math.max(selection.anchor.blockIndex, selection.focus.blockIndex);

  const isForward =
    selection.anchor.blockIndex < selection.focus.blockIndex ||
    (selection.anchor.blockIndex === selection.focus.blockIndex &&
      selection.anchor.offset <= selection.focus.offset);

  const startOffset = isForward ? selection.anchor.offset : selection.focus.offset;
  const endOffset = isForward ? selection.focus.offset : selection.anchor.offset;

  const startBlock = blocks[startIdx];
  const endBlock = blocks[endIdx];

  if (!startBlock || !endBlock) {
    return { newBlocks: blocks, targetBlockId: blocks[0]?.id || '', targetOffset: 0 };
  }

  const startContent = startBlock.content || '';
  const endContent = endBlock.content || '';

  const prefix = startContent.slice(0, startOffset);
  const suffix = endContent.slice(endOffset);
  const mergedContent = prefix + replacementText + suffix;

  const newBlocks = [...blocks];

  // Update startBlock with merged content
  newBlocks[startIdx] = {
    ...startBlock,
    content: mergedContent,
  };

  // Remove intermediate blocks and endBlock
  if (endIdx > startIdx) {
    newBlocks.splice(startIdx + 1, endIdx - startIdx);
  }

  return {
    newBlocks,
    targetBlockId: startBlock.id,
    targetOffset: prefix.length + replacementText.length,
  };
}

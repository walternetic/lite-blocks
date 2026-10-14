import React, { useRef, useEffect, useState, useCallback } from 'react';
import { NoteBlock, BlockType } from '../types/note';
import { resolveCrossWorkspaceLink } from '../lib/workspaceStorage';
import { PageLinkModal } from './PageLinkModal';
import { handleBlockCopy, parseClipboardPaste, isShiftPasteActive } from '../lib/clipboard';

export interface LinkSegment {
  type: 'link';
  raw: string;
  wsName: string;
  noteTitle?: string;
  customLabel?: string;
}

export interface TextSegment {
  type: 'text';
  text: string;
}

export type ContentSegment = TextSegment | LinkSegment;

/**
 * Parse content into text and link segments.
 * Supports [[wsName/noteTitle|customLabel]], [[wsName/noteTitle]], and [[wsName]].
 */
export function parseContentSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const regex = /\[\[(.*?)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        text: content.slice(lastIndex, match.index),
      });
    }

    const full = match[1].trim();
    const pipeParts = full.split('|');
    const pathPart = pipeParts[0].trim();
    const customLabel = pipeParts[1]?.trim();

    const slashParts = pathPart.split(/[\/#]/);
    const wsName = slashParts[0]?.trim();
    const noteTitle = slashParts[1]?.trim();

    if (wsName) {
      segments.push({
        type: 'link',
        raw: match[0],
        wsName,
        noteTitle,
        customLabel,
      });
    } else {
      segments.push({
        type: 'text',
        text: match[0],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      text: content.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Serialize DOM elements inside container back to Wikilink content string.
 */
function serializeDomContent(container: HTMLElement): string {
  let result = '';
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const raw = el.getAttribute('data-link-raw');
      if (raw) {
        result += raw;
      } else if (el.nodeName === 'BR') {
        result += '\n';
      } else {
        result += el.textContent || '';
      }
    }
  }
  return result;
}

/**
 * Calculate caret character offset in the serialized text format.
 */
function getCaretCharacterOffset(container: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(container);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  const fragment = preCaretRange.cloneContents();
  let offset = 0;
  for (const node of Array.from(fragment.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length || 0;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const raw = el.getAttribute('data-link-raw');
      if (raw) {
        offset += raw.length;
      } else if (el.nodeName === 'BR') {
        offset += 1;
      } else {
        offset += el.textContent?.length || 0;
      }
    }
  }
  return offset;
}

/**
 * Set caret character offset in the container.
 */
function setCaretCharacterOffset(container: HTMLElement, targetOffset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  let current = 0;
  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(true);

  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (current + len >= targetOffset) {
        const offsetInNode = Math.min(targetOffset - current, len);
        range.setStart(node, offsetInNode);
        range.setEnd(node, offsetInNode);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      current += len;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const raw = el.getAttribute('data-link-raw');
      const len = raw ? raw.length : el.textContent?.length || 0;
      if (current + len >= targetOffset) {
        range.setStartAfter(node);
        range.setEndAfter(node);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      current += len;
    }
  }

  // Fallback: place at end
  range.selectNodeContents(container);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

interface InlineRichEditorProps {
  block: NoteBlock;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  autoFocus?: boolean;
  focusPosition?: 'start' | 'end' | number;
  onFocusHandled?: () => void;
  onUpdate: (updatedBlock: NoteBlock) => void;
  onInsertBelow: (
    type: BlockType,
    afterIndex: number,
    currentBlockContent?: string,
    newBlockContent?: string,
    blockData?: Partial<NoteBlock>
  ) => void;
  onMergeWithPrevious: (index: number) => void;
  onMergeWithNext: (index: number) => void;
  index: number;
  totalBlocks: number;
  showSlashMenu?: boolean;
  onSlashTrigger?: (val: string) => void;
  dataBlockId?: string;
}

export const InlineRichEditor: React.FC<InlineRichEditorProps> = ({
  block,
  className = '',
  style,
  placeholder,
  autoFocus,
  focusPosition,
  onFocusHandled,
  onUpdate,
  onInsertBelow,
  onMergeWithPrevious,
  onMergeWithNext,
  index,
  totalBlocks,
  showSlashMenu,
  onSlashTrigger,
  dataBlockId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSyncedContentRef = useRef<string>(block.content || '');
  const [editingLink, setEditingLink] = useState<LinkSegment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Build the DOM inside the contentEditable container
  const renderDom = useCallback(
    (container: HTMLElement, content: string) => {
      container.innerHTML = '';
      const segments = parseContentSegments(content);

      if (segments.length === 0) {
        return;
      }

      for (const seg of segments) {
        if (seg.type === 'text') {
          container.appendChild(document.createTextNode(seg.text));
        } else if (seg.type === 'link') {
          const link = resolveCrossWorkspaceLink(seg.wsName, seg.noteTitle);
          const badge = document.createElement('span');
          badge.setAttribute('contenteditable', 'false');
          badge.setAttribute('data-link-raw', seg.raw);
          badge.setAttribute('data-ws-name', seg.wsName);
          if (seg.noteTitle) badge.setAttribute('data-note-title', seg.noteTitle);
          if (seg.customLabel) badge.setAttribute('data-custom-label', seg.customLabel);

          badge.className =
            'page-link-badge inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-0.5 rounded-lg border text-xs font-medium cursor-pointer hover:border-[var(--theme-accent)] transition-all shadow-2xs align-middle group/link selection:bg-[var(--theme-accent)] selection:text-[var(--theme-accent-text)]';
          badge.style.backgroundColor = 'var(--theme-bg-surface)';
          badge.style.borderColor = 'var(--theme-border)';
          badge.style.color = 'var(--theme-text-main)';
          badge.title = link.noteTitle
            ? `Clic: apri "${link.noteTitle}" (${link.workspaceName}) in nuova scheda · Tasto destro o Shift+Clic: modifica`
            : `Clic: apri workspace "${link.workspaceName}" in nuova scheda · Tasto destro o Shift+Clic: modifica`;

          // Workspace icon & name
          const wsIconSpan = document.createElement('span');
          wsIconSpan.className = 'text-xs shrink-0 leading-none';
          wsIconSpan.textContent = link.workspaceIcon;

          const wsNameSpan = document.createElement('span');
          wsNameSpan.className = 'font-semibold text-[var(--theme-text-main)]';
          wsNameSpan.textContent = link.workspaceName;

          badge.appendChild(wsIconSpan);
          badge.appendChild(wsNameSpan);

          // Note icon & title only if present
          if (link.noteTitle || seg.customLabel) {
            const slashSpan = document.createElement('span');
            slashSpan.style.color = 'var(--theme-text-muted)';
            slashSpan.className = 'font-normal';
            slashSpan.textContent = '/';

            const noteIconSpan = document.createElement('span');
            noteIconSpan.className = 'text-xs shrink-0 leading-none';
            noteIconSpan.textContent = link.noteIcon;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'truncate max-w-[200px] group-hover/link:underline';
            titleSpan.textContent = seg.customLabel || link.noteTitle;

            badge.appendChild(slashSpan);
            badge.appendChild(noteIconSpan);
            badge.appendChild(titleSpan);
          }

          // Left Click (open in new tab) or Shift+Click (edit)
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.shiftKey) {
              e.preventDefault();
              setEditingLink(seg);
              setIsModalOpen(true);
            } else {
              window.open(link.url, '_blank', 'noopener,noreferrer');
            }
          });

          // Right Click (onContextMenu)
          badge.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setEditingLink(seg);
            setIsModalOpen(true);
          });

          container.appendChild(badge);
        }
      }
    },
    []
  );

  // Sync DOM only when content changed from external update
  useEffect(() => {
    if (containerRef.current && block.content !== lastSyncedContentRef.current) {
      lastSyncedContentRef.current = block.content;
      renderDom(containerRef.current, block.content);
    }
  }, [block.content, renderDom]);

  // Initial mount render
  useEffect(() => {
    if (containerRef.current) {
      renderDom(containerRef.current, block.content || '');
    }
  }, []);

  // Auto-focus handling
  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.focus();
      const currentContent = block.content || '';
      const target =
        focusPosition === 'end'
          ? currentContent.length
          : typeof focusPosition === 'number'
          ? focusPosition
          : 0;
      setCaretCharacterOffset(containerRef.current, target);
      onFocusHandled?.();
    }
  }, [autoFocus, focusPosition, onFocusHandled, block.content]);

  // Input event when typing
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const prev = lastSyncedContentRef.current;
    const serialized = serializeDomContent(e.currentTarget);
    lastSyncedContentRef.current = serialized;

    if (onSlashTrigger && serialized.startsWith('/')) {
      onSlashTrigger(serialized);
    }

    onUpdate({ ...block, content: serialized });

    // Detect if a wikilink tag was newly completed with ]]
    const prevTags = prev.match(/\[\[([^\]]+)\]\]/g) || [];
    const newTags = serialized.match(/\[\[([^\]]+)\]\]/g) || [];
    if (newTags.length > prevTags.length) {
      const newlyClosedTag = newTags.find((t, i) => prevTags[i] !== t) || newTags[newTags.length - 1];
      const inner = newlyClosedTag.slice(2, -2).trim();
      const pipeParts = inner.split('|');
      const pathPart = pipeParts[0].trim();
      const customLabel = pipeParts[1]?.trim();
      const slashParts = pathPart.split(/[\/#]/);
      const wsName = slashParts[0]?.trim();
      const noteTitle = slashParts[1]?.trim();

      setEditingLink({
        type: 'link',
        raw: newlyClosedTag,
        wsName: wsName || '',
        noteTitle,
        customLabel,
      });
      setIsModalOpen(true);
    }
  };

  const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    handleBlockCopy(e);
  };

  const handleCut = (e: React.ClipboardEvent<HTMLDivElement>) => {
    handleBlockCopy(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const isForcePlain = isShiftPasteActive() || !e.clipboardData.types.includes('text/html');
    const { text } = parseClipboardPaste(e.clipboardData, isForcePlain);
    e.preventDefault();
    const container = containerRef.current;
    if (container) {
      const offset = getCaretCharacterOffset(container);
      const current = block.content || '';
      const updated = current.slice(0, offset) + text + current.slice(offset);
      lastSyncedContentRef.current = updated;
      onUpdate({ ...block, content: updated });
      renderDom(container, updated);
      setCaretCharacterOffset(container, offset + text.length);
    }
  };

  // Keyboard navigation & block splitting / merging
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showSlashMenu) return;

    const container = containerRef.current;
    if (!container) return;

    const currentContent = block.content || '';
    const offset = getCaretCharacterOffset(container);
    const selection = window.getSelection();
    const isCollapsed = selection ? selection.isCollapsed : true;
    const isAtStart = isCollapsed && offset === 0;
    const isAtEnd = isCollapsed && offset === currentContent.length;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const beforeText = currentContent.slice(0, offset);
      const afterText = currentContent.slice(offset);

      const nextType: BlockType = block.type === 'todo' ? 'todo' : 'paragraph';
      onInsertBelow(nextType, index, beforeText, afterText);
    } else if (e.key === 'Backspace' && isAtStart) {
      if (index > 0) {
        e.preventDefault();
        onMergeWithPrevious(index);
      } else if (block.content === '' && block.type !== 'paragraph') {
        e.preventDefault();
        onUpdate({ ...block, type: 'paragraph' });
      }
    } else if (e.key === 'Delete' && isAtEnd) {
      if (index < totalBlocks - 1) {
        e.preventDefault();
        onMergeWithNext(index);
      }
    }
  };

  // Modal Save Handler
  const handleSaveModal = (newWsName: string, newNoteTitle?: string, newCustomLabel?: string) => {
    if (!editingLink) return;

    const targetPart = newNoteTitle ? `${newWsName}/${newNoteTitle}` : newWsName;
    const newRaw = newCustomLabel ? `[[${targetPart}|${newCustomLabel}]]` : `[[${targetPart}]]`;

    const oldRaw = editingLink.raw;
    const currentContent = block.content || '';
    const newContent = currentContent.replace(oldRaw, newRaw);

    lastSyncedContentRef.current = newContent;
    onUpdate({ ...block, content: newContent });

    if (containerRef.current) {
      renderDom(containerRef.current, newContent);
    }
  };

  // Modal Delete Link Handler
  const handleDeleteLink = () => {
    if (!editingLink) return;

    const oldRaw = editingLink.raw;
    const currentContent = block.content || '';
    const plainText = editingLink.customLabel || editingLink.noteTitle || editingLink.wsName;
    const newContent = currentContent.replace(oldRaw, plainText);

    lastSyncedContentRef.current = newContent;
    onUpdate({ ...block, content: newContent });

    if (containerRef.current) {
      renderDom(containerRef.current, newContent);
    }
  };

  const isEmpty = !block.content || block.content.trim() === '';

  return (
    <>
      <div className="relative w-full">
        {isEmpty && placeholder && (
          <span
            style={{ color: 'var(--theme-text-muted)' }}
            className="absolute left-0 top-0 pointer-events-none select-none text-sm opacity-70"
          >
            {placeholder}
          </span>
        )}
        <div
          ref={containerRef}
          data-block-id={dataBlockId || block.id}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          style={style}
          className={`w-full bg-transparent outline-none leading-relaxed transition-colors min-h-[1.5em] whitespace-pre-wrap break-words ${className}`}
        />
      </div>

      {editingLink && (
        <PageLinkModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingLink(null);
          }}
          initialWsName={editingLink.wsName}
          initialNoteTitle={editingLink.noteTitle}
          initialCustomLabel={editingLink.customLabel}
          onSave={handleSaveModal}
          onDeleteLink={handleDeleteLink}
        />
      )}
    </>
  );
};

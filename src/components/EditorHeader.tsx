import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Note } from '../types/note';
import { EmojiPicker } from './EmojiPicker';
import { CoverPickerModal } from './CoverPickerModal';
import {
  getContentWidthCss,
  ConcreteContentWidth,
} from '../lib/contentWidth';
import {
  getTextareaCaretCoordinates,
  isTextareaOnLastLine,
  findClosestTextareaIndexForClientX,
} from '../lib/caretCoordinates';
import { Image as ImageIcon, Smile } from 'lucide-react';

interface EditorHeaderProps {
  note: Note;
  defaultContentWidth?: ConcreteContentWidth;
  focusedBlockTarget?: {
    id: string;
    cursorPosition?: 'start' | 'end' | number;
    targetClientX?: number;
    targetLine?: 'first' | 'last';
  } | null;
  onFocusHandled?: () => void;
  onNavigateCursor?: (
    direction: 'up' | 'down',
    fromIndex: number | 'title',
    currentClientX: number
  ) => void;
  onSelectAllPage?: () => void;
  onUpdateNote: (fields: Partial<Note>) => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  note,
  defaultContentWidth,
  focusedBlockTarget,
  onFocusHandled,
  onNavigateCursor,
  onSelectAllPage,
  onUpdateNote,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [isHoveringCover, setIsHoveringCover] = useState(false);

  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize title textarea and prevent any internal scroll overflow
  const adjustTitleHeight = useCallback(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTitleHeight();
  }, [note.title, note.contentWidth, defaultContentWidth, adjustTitleHeight]);

  const lastTitleWidthRef = useRef<number>(0);

  useEffect(() => {
    const el = titleTextareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    lastTitleWidthRef.current = Math.round(el.getBoundingClientRect().width);

    let rafId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.round(entry.contentRect.width);
        if (newWidth > 0 && Math.abs(newWidth - lastTitleWidthRef.current) >= 1) {
          lastTitleWidthRef.current = newWidth;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            adjustTitleHeight();
          });
        }
      }
    });

    observer.observe(el);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [adjustTitleHeight]);

  // Focus title when requested (e.g. navigation upwards from block 0)
  useEffect(() => {
    if (focusedBlockTarget?.id === 'note-title' && titleTextareaRef.current) {
      const el = titleTextareaRef.current;
      el.focus();
      let pos = 0;
      if (focusedBlockTarget.targetClientX !== undefined && focusedBlockTarget.targetLine) {
        pos = findClosestTextareaIndexForClientX(
          el,
          focusedBlockTarget.targetClientX,
          focusedBlockTarget.targetLine
        );
      } else if (focusedBlockTarget.cursorPosition === 'end') {
        pos = el.value.length;
      } else if (typeof focusedBlockTarget.cursorPosition === 'number') {
        pos = focusedBlockTarget.cursorPosition;
      }
      el.setSelectionRange(pos, pos);
      onFocusHandled?.();
    }
  }, [focusedBlockTarget, onFocusHandled]);

  return (
    <div className="relative w-full">

      {/* Cover image banner */}
      {note.coverUrl ? (
        <div
          onMouseEnter={() => setIsHoveringCover(true)}
          onMouseLeave={() => setIsHoveringCover(false)}
          className="relative h-48 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 group/cover"
        >
          <img
            src={note.coverUrl}
            alt="Copertina"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          {isHoveringCover && (
            <div className="absolute bottom-3 right-6 flex items-center gap-2 bg-black/60 backdrop-blur-xs px-2.5 py-1.5 rounded-lg text-xs text-white">
              <button
                onClick={() => setShowCoverPicker(true)}
                className="hover:underline flex items-center gap-1 font-medium"
              >
                <ImageIcon className="w-3.5 h-3.5" /> Cambia copertina
              </button>
              <span>·</span>
              <button
                onClick={() => onUpdateNote({ coverUrl: undefined })}
                className="hover:underline font-medium text-rose-300"
              >
                Rimuovi
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="h-6" />
      )}

      {/* Cover Picker Modal */}
      {showCoverPicker && (
        <CoverPickerModal
          currentCover={note.coverUrl}
          onSelect={(url) => onUpdateNote({ coverUrl: url })}
          onRemove={() => onUpdateNote({ coverUrl: undefined })}
          onClose={() => setShowCoverPicker(false)}
        />
      )}

      {/* Page header title & icon area */}
      <div
        style={{ maxWidth: getContentWidthCss(note.contentWidth, defaultContentWidth) }}
        className="w-full mx-auto px-12 pt-4 pb-2 transition-[max-width] duration-150"
        onTransitionEnd={(e) => {
          if (e.propertyName === 'max-width') {
            window.dispatchEvent(new Event('resize'));
          }
        }}
      >
        {/* Quick Add buttons (Cover, Icon) when not set */}
        <div
          style={{ color: 'var(--theme-text-muted)' }}
          className="flex items-center gap-3 text-xs mb-2"
        >
          {!note.icon && (
            <button
              onClick={() => setShowEmojiPicker(true)}
              className="flex items-center gap-1 hover:text-[var(--theme-text-main)] transition-colors"
            >
              <Smile className="w-3.5 h-3.5" /> Aggiungi icona
            </button>
          )}
          {!note.coverUrl && (
            <button
              onClick={() => setShowCoverPicker(true)}
              className="flex items-center gap-1 hover:text-[var(--theme-text-main)] transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5" /> Aggiungi copertina
            </button>
          )}
        </div>

        {/* Note Emoji Icon */}
        {note.icon && (
          <div className="relative mb-3">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-5xl hover:opacity-85 transition-opacity"
              title="Cambia icona"
            >
              {note.icon}
            </button>

            {showEmojiPicker && (
              <EmojiPicker
                currentEmoji={note.icon}
                onSelect={(emoji) => onUpdateNote({ icon: emoji })}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        )}

        {/* Note Title Input (Auto-resizing textarea with overflow-hidden to eliminate internal scroll) */}
        <textarea
          ref={titleTextareaRef}
          data-block-id="note-title"
          rows={1}
          value={note.title}
          onChange={(e) => onUpdateNote({ title: e.target.value })}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !e.shiftKey && !e.altKey) {
              const el = titleTextareaRef.current;
              if (el) {
                const len = el.value.length;
                if (len === 0 || (el.selectionStart === 0 && el.selectionEnd === len)) {
                  e.preventDefault();
                  onSelectAllPage?.();
                  return;
                } else {
                  e.preventDefault();
                  el.select();
                  return;
                }
              }
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const firstBlock = document.querySelector<HTMLTextAreaElement>(
                '[data-block-id]:not([data-block-id="note-title"])'
              );
              firstBlock?.focus();
            } else if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
              const el = titleTextareaRef.current;
              if (el && el.selectionStart === el.selectionEnd && isTextareaOnLastLine(el)) {
                e.preventDefault();
                const coords = getTextareaCaretCoordinates(el, el.selectionStart ?? 0);
                onNavigateCursor?.('down', 'title', coords.clientX);
              }
            }
          }}
          placeholder="Senza titolo"
          style={{ color: 'var(--theme-text-main)' }}
          className="w-full font-display text-4xl font-extrabold tracking-tight bg-transparent border-none outline-none resize-none overflow-hidden block p-0 m-0 leading-tight"
        />
      </div>
    </div>
  );
};

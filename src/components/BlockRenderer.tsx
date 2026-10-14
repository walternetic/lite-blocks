import React, { useState, useRef, useEffect } from 'react';
import { NoteBlock, BlockType } from '../types/note';
import { SlashCommandMenu } from './SlashCommandMenu';
import { InlineRichEditor } from './InlineRichEditor';
import { PageLinkModal } from './PageLinkModal';
import {
  handleBlockCopy,
  parseClipboardPaste,
  isShiftPasteActive,
  buildMultiMimeClipboard,
  useLocalClipboard,
  getLocalClipboard,
  setLocalClipboard,
} from '../lib/clipboard';
import {
  Plus,
  GripVertical,
  Check,
  Copy,
  Upload,
  Image as ImageIcon,
  Paperclip,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  Maximize2,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
} from 'lucide-react';

interface BlockRendererProps {
  block: NoteBlock;
  index: number;
  totalBlocks: number;
  autoFocus?: boolean;
  focusPosition?: 'start' | 'end' | number;
  onFocusHandled?: () => void;
  onUpdate: (updatedBlock: NoteBlock) => void;
  onDelete: (blockId: string) => void;
  onInsertBelow: (
    type: BlockType,
    afterIndex: number,
    currentBlockContent?: string,
    newBlockContent?: string,
    blockData?: Partial<NoteBlock>
  ) => void;
  onMergeWithPrevious: (index: number) => void;
  onMergeWithNext: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDuplicate: (index: number) => void;
  onOpenLightbox: (src: string, caption?: string) => void;
  onReorderBlocks: (sourceIndex: number, targetIndex: number, position: 'top' | 'bottom') => void;
  onNavigateCrossWorkspace?: (workspaceName: string, noteTitle?: string) => void;
}

const LANGUAGES = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'sql', label: 'SQL' },
  { id: 'json', label: 'JSON' },
  { id: 'bash', label: 'Bash / Shell' },
  { id: 'markdown', label: 'Markdown' },
];

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  index,
  totalBlocks,
  autoFocus,
  focusPosition,
  onFocusHandled,
  onUpdate,
  onDelete,
  onInsertBelow,
  onMergeWithPrevious,
  onMergeWithNext,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onOpenLightbox,
  onReorderBlocks,
  onNavigateCrossWorkspace,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const { hasContent: hasLocalClipboardContent } = useLocalClipboard();
  const [slashQuery, setSlashQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<'top' | 'bottom' | null>(null);
  const [isBeingDragged, setIsBeingDragged] = useState(false);
  const [linkModalState, setLinkModalState] = useState<{
    isOpen: boolean;
    rawTagToReplace?: string;
    initialWsName?: string;
    initialNoteTitle?: string;
    initialCustomLabel?: string;
  }>({ isOpen: false });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const prevContentRef = useRef<string>(block.content || '');
  const optionsContainerRef = useRef<HTMLDivElement>(null);
  const subMenuTimeoutRef = useRef<number | null>(null);

  // Click outside to dismiss block options menu and submenu
  useEffect(() => {
    if (!showOptionsMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsContainerRef.current && !optionsContainerRef.current.contains(e.target as Node)) {
        setShowOptionsMenu(false);
        setShowSubMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOptionsMenu]);

  // Clean up submenu timer on unmount
  useEffect(() => {
    return () => {
      if (subMenuTimeoutRef.current) {
        window.clearTimeout(subMenuTimeoutRef.current);
      }
    };
  }, []);

  const handleSubMenuEnter = () => {
    if (subMenuTimeoutRef.current) {
      window.clearTimeout(subMenuTimeoutRef.current);
      subMenuTimeoutRef.current = null;
    }
    setShowSubMenu(true);
  };

  const handleSubMenuLeave = () => {
    if (subMenuTimeoutRef.current) {
      window.clearTimeout(subMenuTimeoutRef.current);
    }
    subMenuTimeoutRef.current = window.setTimeout(() => {
      setShowSubMenu(false);
      subMenuTimeoutRef.current = null;
    }, 150);
  };

  useEffect(() => {
    prevContentRef.current = block.content || '';
  }, [block.content]);

  // Auto-resize textarea to fit text without scrollbar
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [block.content]);

  // Auto-focus management when requested (e.g. on Enter key block creation or Backspace delete)
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      const pos =
        focusPosition === 'end'
          ? el.value.length
          : typeof focusPosition === 'number'
          ? focusPosition
          : 0;
      el.setSelectionRange(pos, pos);
      onFocusHandled?.();
    }
  }, [autoFocus, focusPosition, onFocusHandled]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    setIsBeingDragged(true);
  };

  const handleDragEnd = () => {
    setIsBeingDragged(false);
    setDropIndicator(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    // Only allow 'bottom' if this is the very last block in the document and cursor is in lower half
    const isLastBlock = index === totalBlocks - 1;
    if (isLastBlock) {
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDropIndicator(e.clientY < midY ? 'top' : 'bottom');
    } else {
      // For all other blocks, always use single unambiguous 'top' boundary (insert before this block)
      setDropIndicator('top');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropIndicator(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (!isNaN(sourceIndex) && dropIndicator) {
      onReorderBlocks(sourceIndex, index, dropIndicator);
    }
    setDropIndicator(null);
    setIsBeingDragged(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const prev = prevContentRef.current;
    prevContentRef.current = val;

    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashQuery(val);
    } else {
      setShowSlashMenu(false);
    }
    onUpdate({ ...block, content: val });

    // Check if the user just completed a wikilink tag with ]]
    const prevTags = prev.match(/\[\[([^\]]+)\]\]/g) || [];
    const newTags = val.match(/\[\[([^\]]+)\]\]/g) || [];
    if (newTags.length > prevTags.length) {
      const newlyClosedTag = newTags.find((t, i) => prevTags[i] !== t) || newTags[newTags.length - 1];
      const inner = newlyClosedTag.slice(2, -2).trim();
      const pipeParts = inner.split('|');
      const pathPart = pipeParts[0].trim();
      const customLabel = pipeParts[1]?.trim();
      const slashParts = pathPart.split(/[\/#]/);
      const wsName = slashParts[0]?.trim();
      const noteTitle = slashParts[1]?.trim();

      setLinkModalState({
        isOpen: true,
        rawTagToReplace: newlyClosedTag,
        initialWsName: wsName || '',
        initialNoteTitle: noteTitle,
        initialCustomLabel: customLabel,
      });
    }
  };

  const handleTextareaCopy = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const sel = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
      if (sel) {
        handleBlockCopy(e, sel);
      }
    }
  };

  const handleTextareaCut = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const sel = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
      if (sel) {
        handleBlockCopy(e, sel);
      }
    }
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const isForcePlain = isShiftPasteActive() || !e.clipboardData.types.includes('text/html');
    const { text } = parseClipboardPaste(e.clipboardData, isForcePlain);
    e.preventDefault();
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const current = block.content || '';
      const updated = current.slice(0, start) + text + current.slice(end);
      prevContentRef.current = updated;
      onUpdate({ ...block, content: updated });
      setTimeout(() => {
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    }
  };

  const handleCopyBlock = async () => {
    try {
      const textToCopy = block.content || '';
      const { plain, html } = buildMultiMimeClipboard(textToCopy);

      const blockData: Partial<NoteBlock> = {
        type: block.type,
        content: block.content,
        language: block.language,
        caption: block.caption,
        completed: block.completed,
        fileName: block.fileName,
        fileSize: block.fileSize,
        fileType: block.fileType,
        fileUrl: block.fileUrl,
        icon: block.icon,
      };

      // Save to local clipboard with full block metadata
      setLocalClipboard({
        text: plain,
        html,
        block: blockData,
      });

      // Save to system clipboard
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        });
        await navigator.clipboard.write([item]);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(plain);
      }
      setShowOptionsMenu(false);
    } catch (err) {
      console.error('Failed to copy block content:', err);
    }
  };

  const handlePasteBelow = () => {
    try {
      const local = getLocalClipboard();
      if (!local || (!local.text && !local.block)) return;

      if (local.block) {
        onInsertBelow(
          local.block.type || 'paragraph',
          index,
          undefined,
          local.block.content || '',
          local.block
        );
      } else {
        const nextType: BlockType = block.type === 'todo' ? 'todo' : 'paragraph';
        onInsertBelow(nextType, index, undefined, local.text);
      }
      setShowOptionsMenu(false);
    } catch (err) {
      console.error('Failed to paste below block from local clipboard:', err);
    }
  };

  const handlePasteOver = () => {
    try {
      const local = getLocalClipboard();
      if (!local || (!local.text && !local.block)) return;

      if (local.block) {
        onUpdate({
          ...block,
          type: local.block.type || block.type,
          content: local.block.content ?? block.content,
          language: local.block.language,
          caption: local.block.caption,
          completed: local.block.completed,
          fileName: local.block.fileName,
          fileSize: local.block.fileSize,
          fileType: local.block.fileType,
          fileUrl: local.block.fileUrl,
          icon: local.block.icon,
        });
      } else {
        onUpdate({ ...block, content: local.text });
      }
      setShowOptionsMenu(false);
      setShowSubMenu(false);
    } catch (err) {
      console.error('Failed to replace block with local clipboard:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) return; // handled by slash menu

    const textarea = textareaRef.current;
    const currentContent = block.content || '';
    const selStart = textarea ? textarea.selectionStart : currentContent.length;
    const selEnd = textarea ? textarea.selectionEnd : currentContent.length;
    const isAtStart = selStart === 0 && selEnd === 0;
    const isAtEnd = selStart === currentContent.length && selEnd === currentContent.length;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const beforeText = currentContent.slice(0, selStart);
      const afterText = currentContent.slice(selStart);

      // If in todo, create another todo; otherwise create paragraph
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

  const handleCopyCode = async () => {
    try {
      const blockData: Partial<NoteBlock> = {
        type: 'code',
        content: block.content,
        language: block.language,
      };
      setLocalClipboard({
        text: block.content,
        block: blockData,
      });
      await navigator.clipboard.writeText(block.content);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onUpdate({
          ...block,
          content: result,
          caption: file.name,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onUpdate({
          ...block,
          fileUrl: result,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // Detect if block contains embedded wikilinks [[workspace/nota]] or [[workspace]]
  const hasLinks = block.content ? /\[\[(.*?)\]\]/.test(block.content) : false;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative flex items-start -ml-9 pl-9 py-1 rounded-lg transition-opacity ${
        isBeingDragged ? 'opacity-35 scale-[0.99]' : 'opacity-100'
      }`}
    >
      {/* Drop indicator line with block-editor pip */}
      {dropIndicator === 'top' && (
        <div className="absolute -top-1 left-2 right-0 flex items-center z-30 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0 shadow-xs" />
          <div className="flex-1 h-0.5 bg-blue-500 dark:bg-blue-400 rounded-r-full shadow-xs" />
        </div>
      )}
      {dropIndicator === 'bottom' && (
        <div className="absolute -bottom-1 left-2 right-0 flex items-center z-30 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0 shadow-xs" />
          <div className="flex-1 h-0.5 bg-blue-500 dark:bg-blue-400 rounded-r-full shadow-xs" />
        </div>
      )}

      {/* Block Hover Gutter Handle - strictly in the left margin, 0% overlap with content */}
      <div className="absolute left-1 top-1.5 z-20">
        <div ref={optionsContainerRef} className="relative">
          <button
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={(e) => {
              e.stopPropagation();
              setShowOptionsMenu(!showOptionsMenu);
            }}
            title="Trascina per spostare o clicca per il menu"
            className={`w-6 h-6 rounded flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-all ${
              isHovered || showOptionsMenu
                ? 'opacity-100'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          {/* Block Options Dropdown Menu */}
          {showOptionsMenu && (
            <div 
              className="absolute left-0 top-full pt-1 z-40 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl py-1 text-xs text-neutral-700 dark:text-neutral-300 animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  setShowSlashMenu(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left font-medium text-neutral-900 dark:text-neutral-100"
              >
                <Plus className="w-3.5 h-3.5 text-blue-500" /> Inserisci blocco sotto
              </button>
              <button
                onClick={() => {
                  onDuplicate(index);
                  setShowOptionsMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left"
              >
                <Copy className="w-3.5 h-3.5" /> Duplica
              </button>
              <button
                onClick={handleCopyBlock}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left"
              >
                <Copy className="w-3.5 h-3.5 text-neutral-500" /> Copia
              </button>
              <button
                onClick={handlePasteBelow}
                disabled={!hasLocalClipboardContent}
                title={hasLocalClipboardContent ? 'Incolla dalla clipboard locale sotto questo blocco' : 'Nessun contenuto nella clipboard locale'}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                  hasLocalClipboardContent
                    ? 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed text-neutral-400 dark:text-neutral-500'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-neutral-500" /> Incolla sotto
              </button>

              <div className="my-1 border-t border-neutral-100 dark:border-neutral-700" />

              {/* Conventional flyout submenu for "Altre.." */}
              <div
                className="relative group/submenu"
                onMouseEnter={handleSubMenuEnter}
                onMouseLeave={handleSubMenuLeave}
              >
                <button
                  onClick={() => setShowSubMenu(!showSubMenu)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left font-medium text-neutral-800 dark:text-neutral-200"
                >
                  <span className="flex items-center gap-2">
                    <MoreHorizontal className="w-3.5 h-3.5 text-neutral-500" /> Altre..
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                </button>

                {showSubMenu && (
                  <div
                    className="absolute left-full top-0 ml-1 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl py-1 text-xs text-neutral-700 dark:text-neutral-300 animate-in fade-in zoom-in-95 duration-100 z-50 before:absolute before:-left-3 before:top-0 before:bottom-0 before:w-3 before:content-['']"
                    onMouseEnter={handleSubMenuEnter}
                    onMouseLeave={handleSubMenuLeave}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={handlePasteOver}
                      disabled={!hasLocalClipboardContent}
                      title={hasLocalClipboardContent ? 'Sostituisci il blocco con il contenuto della clipboard locale' : 'Nessun contenuto nella clipboard locale'}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                        hasLocalClipboardContent
                          ? 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed text-neutral-400 dark:text-neutral-500'
                      }`}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 text-blue-500" /> Sostituisci con clipboard
                    </button>

                    <div className="my-1 border-t border-neutral-100 dark:border-neutral-700" />

                    <button
                      onClick={() => {
                        onMoveUp(index);
                        setShowOptionsMenu(false);
                        setShowSubMenu(false);
                      }}
                      disabled={index === 0}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none text-left text-neutral-700 dark:text-neutral-300"
                    >
                      <ArrowUp className="w-3.5 h-3.5" /> Sposta su
                    </button>
                    <button
                      onClick={() => {
                        onMoveDown(index);
                        setShowOptionsMenu(false);
                        setShowSubMenu(false);
                      }}
                      disabled={index === totalBlocks - 1}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none text-left text-neutral-700 dark:text-neutral-300"
                    >
                      <ArrowDown className="w-3.5 h-3.5" /> Sposta giù
                    </button>
                    <button
                      onClick={() => {
                        onUpdate({
                          ...block,
                          content: '',
                          caption: undefined,
                          fileName: undefined,
                          fileSize: undefined,
                          fileUrl: undefined,
                        });
                        setShowOptionsMenu(false);
                        setShowSubMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left text-neutral-700 dark:text-neutral-300"
                    >
                      <Trash2 className="w-3.5 h-3.5 opacity-60" /> Pulisci
                    </button>

                    <div className="my-1 border-t border-neutral-100 dark:border-neutral-700" />

                    <button
                      onClick={() => {
                        onDelete(block.id);
                        setShowOptionsMenu(false);
                        setShowSubMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Elimina
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Slash Menu */}
      {showSlashMenu && (
        <SlashCommandMenu
          searchQuery={slashQuery}
          onSelect={(selectedType) => {
            setShowSlashMenu(false);
            setSlashQuery('');
            if (selectedType === 'page_link') {
              setLinkModalState({ isOpen: true });
              return;
            }
            if (block.content.startsWith('/')) {
              onUpdate({ ...block, type: selectedType, content: '' });
            } else {
              onInsertBelow(selectedType, index);
            }
          }}
          onClose={() => {
            setShowSlashMenu(false);
            setSlashQuery('');
          }}
          position={{ top: 28, left: 32 }}
        />
      )}

      {/* Block Main Content */}
      <div className="flex-1 min-w-0">
        {/* Paragraph & Headings */}
        {(block.type === 'paragraph' ||
          block.type === 'heading1' ||
          block.type === 'heading2' ||
          block.type === 'heading3') && (
          hasLinks ? (
            <InlineRichEditor
              block={block}
              index={index}
              totalBlocks={totalBlocks}
              autoFocus={autoFocus}
              focusPosition={focusPosition}
              onFocusHandled={onFocusHandled}
              onUpdate={onUpdate}
              onInsertBelow={onInsertBelow}
              onMergeWithPrevious={onMergeWithPrevious}
              onMergeWithNext={onMergeWithNext}
              showSlashMenu={showSlashMenu}
              onSlashTrigger={(val) => {
                setShowSlashMenu(true);
                setSlashQuery(val);
              }}
              placeholder={
                block.type === 'heading1'
                  ? 'Intestazione 1'
                  : block.type === 'heading2'
                  ? 'Intestazione 2'
                  : block.type === 'heading3'
                  ? 'Intestazione 3'
                  : 'Scrivi qualcosa, oppure digita "/" per i blocchi multimediali...'
              }
              style={{ color: 'var(--theme-text-main)' }}
              className={
                block.type === 'heading1'
                  ? 'font-display text-2xl font-bold tracking-tight'
                  : block.type === 'heading2'
                  ? 'font-display text-xl font-semibold tracking-tight mt-2'
                  : block.type === 'heading3'
                  ? 'font-display text-base font-semibold mt-1'
                  : 'text-sm'
              }
            />
          ) : (
            <textarea
              ref={textareaRef}
              data-block-id={block.id}
              rows={1}
              value={block.content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onCopy={handleTextareaCopy}
              onCut={handleTextareaCut}
              onPaste={handleTextareaPaste}
              placeholder={
                block.type === 'heading1'
                  ? 'Intestazione 1'
                  : block.type === 'heading2'
                  ? 'Intestazione 2'
                  : block.type === 'heading3'
                  ? 'Intestazione 3'
                  : 'Scrivi qualcosa, oppure digita "/" per i blocchi multimediali...'
              }
              style={{ color: 'var(--theme-text-main)' }}
              className={`w-full bg-transparent resize-none border-none outline-none leading-relaxed transition-colors ${
                block.type === 'heading1'
                  ? 'font-display text-2xl font-bold tracking-tight'
                  : block.type === 'heading2'
                  ? 'font-display text-xl font-semibold tracking-tight mt-2'
                  : block.type === 'heading3'
                  ? 'font-display text-base font-semibold mt-1'
                  : 'text-sm'
              }`}
            />
          )
        )}

        {/* To-Do Checklist Block */}
        {block.type === 'todo' && (
          <div className="flex items-start gap-2.5 my-0.5">
            <button
              onClick={() => onUpdate({ ...block, completed: !block.completed })}
              style={
                block.completed
                  ? {
                      backgroundColor: 'var(--theme-accent)',
                      borderColor: 'var(--theme-accent)',
                      color: 'var(--theme-accent-text)',
                    }
                  : {
                      borderColor: 'var(--theme-border)',
                    }
              }
              className="mt-1 w-4 h-4 rounded flex items-center justify-center border transition-all"
            >
              {block.completed && <Check className="w-3 h-3 stroke-[3]" />}
            </button>
            {hasLinks ? (
              <InlineRichEditor
                block={block}
                index={index}
                totalBlocks={totalBlocks}
                autoFocus={autoFocus}
                focusPosition={focusPosition}
                onFocusHandled={onFocusHandled}
                onUpdate={onUpdate}
                onInsertBelow={onInsertBelow}
                onMergeWithPrevious={onMergeWithPrevious}
                onMergeWithNext={onMergeWithNext}
                showSlashMenu={showSlashMenu}
                onSlashTrigger={(val) => {
                  setShowSlashMenu(true);
                  setSlashQuery(val);
                }}
                placeholder="Attività da completare..."
                style={{ color: 'var(--theme-text-main)' }}
                className={`flex-1 text-sm ${block.completed ? 'line-through opacity-50' : ''}`}
              />
            ) : (
              <textarea
                ref={textareaRef}
                data-block-id={block.id}
                rows={1}
                value={block.content}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onCopy={handleTextareaCopy}
                onCut={handleTextareaCut}
                onPaste={handleTextareaPaste}
                placeholder="Attività da completare..."
                style={{ color: 'var(--theme-text-main)' }}
                className={`flex-1 bg-transparent resize-none border-none outline-none text-sm leading-relaxed transition-all ${
                  block.completed
                    ? 'line-through opacity-50'
                    : ''
                }`}
              />
            )}
          </div>
        )}

        {/* Code Snippet Block */}
        {block.type === 'code' && (
          <div className="my-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xs overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-950/60 border-b border-neutral-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                <select
                  value={block.language || 'typescript'}
                  onChange={(e) =>
                    onUpdate({ ...block, language: e.target.value })
                  }
                  className="bg-transparent text-neutral-400 hover:text-neutral-200 focus:outline-none cursor-pointer font-mono text-[11px]"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id} className="bg-neutral-900 text-neutral-100">
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                title="Copia codice"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copiato!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copia</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Textarea */}
            <textarea
              ref={textareaRef}
              data-block-id={block.id}
              rows={3}
              value={block.content}
              onChange={(e) => onUpdate({ ...block, content: e.target.value })}
              onCopy={handleTextareaCopy}
              onCut={handleTextareaCut}
              onPaste={handleTextareaPaste}
              placeholder="// Inserisci o incolla qui il tuo codice..."
              className="w-full p-3 font-mono text-xs bg-transparent resize-none border-none outline-none leading-relaxed text-emerald-300/90 placeholder:text-neutral-600"
              spellCheck={false}
            />
          </div>
        )}

        {/* Image Block */}
        {block.type === 'image' && (
          <div className="my-3">
            {block.content ? (
              <div className="group/img relative rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                <img
                  src={block.content}
                  alt={block.caption || 'Immagine allegata'}
                  className="w-full max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => onOpenLightbox(block.content, block.caption)}
                  referrerPolicy="no-referrer"
                />

                {/* Overlay actions */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/60 backdrop-blur-xs p-1 rounded-lg">
                  <button
                    onClick={() => onOpenLightbox(block.content, block.caption)}
                    title="Ingrandisci"
                    className="p-1 text-white/80 hover:text-white rounded hover:bg-white/20 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onUpdate({ ...block, content: '', caption: '' })}
                    title="Sostituisci"
                    className="p-1 text-white/80 hover:text-white rounded hover:bg-white/20 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Caption input */}
                <div className="p-2 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  <input
                    type="text"
                    value={block.caption || ''}
                    onChange={(e) =>
                      onUpdate({ ...block, caption: e.target.value })
                    }
                    placeholder="Aggiungi una didascalia opzionale..."
                    className="w-full text-xs text-neutral-500 dark:text-neutral-400 bg-transparent border-none outline-none text-center placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50 text-center">
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Aggiungi un'immagine multimediale
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3">
                  Carica un file dal computer oppure specifica un link diretto
                </p>

                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    <Upload className="w-3.5 h-3.5" /> Scegli file
                  </button>
                  <button
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="px-3 py-1.5 text-xs font-medium border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {showUrlInput ? 'Annulla' : 'Incolla URL'}
                  </button>
                </div>

                {showUrlInput && (
                  <div className="mt-3 max-w-md mx-auto flex gap-1.5">
                    <input
                      type="url"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                    <button
                      onClick={() => {
                        if (customImageUrl.trim()) {
                          onUpdate({
                            ...block,
                            content: customImageUrl.trim(),
                            caption: 'Immagine',
                          });
                        }
                      }}
                      disabled={!customImageUrl.trim()}
                      className="px-3 py-1.5 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg disabled:opacity-40"
                    >
                      Inserisci
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* File Attachment Block */}
        {block.type === 'file' && (
          <div className="my-2">
            {block.fileName ? (
              <div className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 shrink-0">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {block.fileName}
                    </div>
                    <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                      {formatFileSize(block.fileSize)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  <a
                    href={block.fileUrl || '#'}
                    download={block.fileName}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Scarica
                  </a>
                  <button
                    onClick={() =>
                      onUpdate({
                        ...block,
                        fileName: undefined,
                        fileSize: undefined,
                        fileUrl: undefined,
                      })
                    }
                    className="p-1 text-neutral-400 hover:text-rose-600 rounded transition-colors"
                    title="Rimuovi allegato"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl bg-neutral-50/40 dark:bg-neutral-900/40 flex items-center justify-between">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileAttachmentUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 block">
                      Carica un allegato file
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      PDF, documenti, archivi o file di progetto
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Upload className="w-3.5 h-3.5" /> Seleziona file
                </button>
              </div>
            )}
          </div>
        )}

        {/* Callout Block */}
        {block.type === 'callout' && (
          <div
            style={{
              backgroundColor: 'var(--theme-callout-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-main)',
            }}
            className="my-2 p-3.5 rounded-xl border flex items-start gap-3"
          >
            <span className="text-lg leading-none mt-0.5">{block.icon || '💡'}</span>
            {hasLinks ? (
              <InlineRichEditor
                block={block}
                index={index}
                totalBlocks={totalBlocks}
                autoFocus={autoFocus}
                focusPosition={focusPosition}
                onFocusHandled={onFocusHandled}
                onUpdate={onUpdate}
                onInsertBelow={onInsertBelow}
                onMergeWithPrevious={onMergeWithPrevious}
                onMergeWithNext={onMergeWithNext}
                showSlashMenu={showSlashMenu}
                onSlashTrigger={(val) => {
                  setShowSlashMenu(true);
                  setSlashQuery(val);
                }}
                placeholder="Scrivi una nota in evidenza o un consiglio..."
                style={{ color: 'var(--theme-text-main)' }}
                className="flex-1 text-xs"
              />
            ) : (
              <textarea
                ref={textareaRef}
                data-block-id={block.id}
                rows={1}
                value={block.content}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onCopy={handleTextareaCopy}
                onCut={handleTextareaCut}
                onPaste={handleTextareaPaste}
                placeholder="Scrivi una nota in evidenza o un consiglio..."
                style={{ color: 'var(--theme-text-main)' }}
                className="flex-1 bg-transparent resize-none border-none outline-none text-xs leading-relaxed"
              />
            )}
          </div>
        )}

        {/* Quote Block */}
        {block.type === 'quote' && (
          <div
            style={{ borderLeftColor: 'var(--theme-accent)' }}
            className="my-2 pl-3 border-l-2"
          >
            {hasLinks ? (
              <InlineRichEditor
                block={block}
                index={index}
                totalBlocks={totalBlocks}
                autoFocus={autoFocus}
                focusPosition={focusPosition}
                onFocusHandled={onFocusHandled}
                onUpdate={onUpdate}
                onInsertBelow={onInsertBelow}
                onMergeWithPrevious={onMergeWithPrevious}
                onMergeWithNext={onMergeWithNext}
                showSlashMenu={showSlashMenu}
                onSlashTrigger={(val) => {
                  setShowSlashMenu(true);
                  setSlashQuery(val);
                }}
                placeholder="Inserisci una citazione..."
                style={{ color: 'var(--theme-text-main)' }}
                className="w-full italic text-sm"
              />
            ) : (
              <textarea
                ref={textareaRef}
                data-block-id={block.id}
                rows={1}
                value={block.content}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onCopy={handleTextareaCopy}
                onCut={handleTextareaCut}
                onPaste={handleTextareaPaste}
                placeholder="Inserisci una citazione..."
                style={{ color: 'var(--theme-text-main)' }}
                className="w-full bg-transparent resize-none border-none outline-none italic text-sm leading-relaxed"
              />
            )}
          </div>
        )}
      </div>

      {/* Modal for creating or editing a link from slash command or tag closing */}
      {linkModalState.isOpen && (
        <PageLinkModal
          isOpen={linkModalState.isOpen}
          onClose={() => setLinkModalState({ isOpen: false })}
          initialWsName={linkModalState.initialWsName}
          initialNoteTitle={linkModalState.initialNoteTitle}
          initialCustomLabel={linkModalState.initialCustomLabel}
          onSave={(wsName, noteTitle, customLabel) => {
            const target = noteTitle ? `${wsName}/${noteTitle}` : wsName;
            const tag = customLabel ? `[[${target}|${customLabel}]]` : `[[${target}]]`;

            let updatedContent = block.content || '';
            if (
              linkModalState.rawTagToReplace &&
              updatedContent.includes(linkModalState.rawTagToReplace)
            ) {
              updatedContent = updatedContent.replace(linkModalState.rawTagToReplace, tag);
            } else {
              const cleanContent = updatedContent.startsWith('/') ? '' : updatedContent;
              updatedContent = cleanContent ? `${cleanContent} ${tag} ` : `${tag} `;
            }

            prevContentRef.current = updatedContent;
            onUpdate({ ...block, content: updatedContent });
            setLinkModalState({ isOpen: false });
          }}
        />
      )}
    </div>
  );
};

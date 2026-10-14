import React, { useState, useRef, useEffect } from 'react';
import { NoteBlock, BlockType } from '../types/note';
import { SlashCommandMenu } from './SlashCommandMenu';
import { resolveCrossWorkspaceLink } from '../lib/workspaceStorage';
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
} from 'lucide-react';

interface BlockRendererProps {
  block: NoteBlock;
  index: number;
  totalBlocks: number;
  onUpdate: (updatedBlock: NoteBlock) => void;
  onDelete: (blockId: string) => void;
  onInsertBelow: (type: BlockType, afterIndex: number) => void;
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
  onUpdate,
  onDelete,
  onInsertBelow,
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
  const [slashQuery, setSlashQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<'top' | 'bottom' | null>(null);
  const [isBeingDragged, setIsBeingDragged] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea to fit text without scrollbar
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [block.content]);

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
    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashQuery(val);
    } else {
      setShowSlashMenu(false);
    }
    onUpdate({ ...block, content: val });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) return; // handled by slash menu

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If in todo, create another todo; otherwise create paragraph
      const nextType: BlockType = block.type === 'todo' ? 'todo' : 'paragraph';
      onInsertBelow(nextType, index);
    } else if (e.key === 'Backspace' && block.content === '') {
      if (block.type !== 'paragraph') {
        e.preventDefault();
        onUpdate({ ...block, type: 'paragraph' });
      } else if (totalBlocks > 1) {
        e.preventDefault();
        onDelete(block.id);
      }
    }
  };

  const handleCopyCode = async () => {
    try {
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

  // Detect cross-workspace links syntax [[workspace/nota]] or [[workspace]]
  const crossWsMatches: { raw: string; wsName: string; noteTitle?: string }[] = [];
  if (block.content && typeof block.content === 'string') {
    const regex = /\[\[(.*?)\]\]/g;
    let match;
    while ((match = regex.exec(block.content)) !== null) {
      const full = match[1].trim();
      if (full) {
        const parts = full.split(/[\/#]/);
        const wsName = parts[0]?.trim();
        const noteTitle = parts[1]?.trim();
        if (wsName) {
          crossWsMatches.push({ raw: match[0], wsName, noteTitle });
        }
      }
    }
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowOptionsMenu(false);
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
        <div className="relative">
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
              <div className="my-1 border-t border-neutral-100 dark:border-neutral-700" />
              <div>
                <button
                  onClick={() => setShowSubMenu(!showSubMenu)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left font-medium text-neutral-800 dark:text-neutral-200"
                >
                  <span className="flex items-center gap-2">
                    <MoreHorizontal className="w-3.5 h-3.5 text-neutral-500" /> Altre azioni
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSubMenu ? 'rotate-180' : ''}`} />
                </button>

                {showSubMenu && (
                  <div className="bg-neutral-50 dark:bg-neutral-900/60 py-1 my-1 border-y border-neutral-200 dark:border-neutral-700">
                    <button
                      onClick={() => {
                        onMoveUp(index);
                        setShowOptionsMenu(false);
                      }}
                      disabled={index === 0}
                      className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none text-left text-neutral-700 dark:text-neutral-300"
                    >
                      <ArrowUp className="w-3.5 h-3.5" /> Sposta su
                    </button>
                    <button
                      onClick={() => {
                        onMoveDown(index);
                        setShowOptionsMenu(false);
                      }}
                      disabled={index === totalBlocks - 1}
                      className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none text-left text-neutral-700 dark:text-neutral-300"
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
                      }}
                      className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left text-neutral-700 dark:text-neutral-300"
                    >
                      <Trash2 className="w-3.5 h-3.5 opacity-60" /> Pulisci
                    </button>
                    <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                    <button
                      onClick={() => {
                        onDelete(block.id);
                        setShowOptionsMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left"
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
          <textarea
            ref={textareaRef}
            data-block-id={block.id}
            rows={1}
            value={block.content}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={
              block.type === 'heading1'
                ? 'Intestazione 1'
                : block.type === 'heading2'
                ? 'Intestazione 2'
                : block.type === 'heading3'
                ? 'Intestazione 3'
                : 'Scrivi qualcosa, oppure digita "/" per i blocchi multimediali...'
            }
            className={`w-full bg-transparent resize-none border-none outline-none leading-relaxed transition-colors ${
              block.type === 'heading1'
                ? 'font-display text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-300 dark:placeholder:text-neutral-600'
                : block.type === 'heading2'
                ? 'font-display text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 mt-2'
                : block.type === 'heading3'
                ? 'font-display text-base font-semibold text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 mt-1'
                : 'text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm'
            }`}
          />
        )}

        {/* To-Do Checklist Block */}
        {block.type === 'todo' && (
          <div className="flex items-start gap-2.5 my-0.5">
            <button
              onClick={() => onUpdate({ ...block, completed: !block.completed })}
              className={`mt-1 w-4 h-4 rounded flex items-center justify-center border transition-all ${
                block.completed
                  ? 'bg-neutral-900 dark:bg-neutral-100 border-neutral-900 dark:border-neutral-100 text-white dark:text-neutral-900'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
              }`}
            >
              {block.completed && <Check className="w-3 h-3 stroke-[3]" />}
            </button>
            <textarea
              ref={textareaRef}
              data-block-id={block.id}
              rows={1}
              value={block.content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Attività da completare..."
              className={`flex-1 bg-transparent resize-none border-none outline-none text-sm leading-relaxed transition-all ${
                block.completed
                  ? 'line-through text-neutral-400 dark:text-neutral-500'
                  : 'text-neutral-800 dark:text-neutral-200'
              }`}
            />
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
          <div className="my-2 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">{block.icon || '💡'}</span>
            <textarea
              ref={textareaRef}
              data-block-id={block.id}
              rows={1}
              value={block.content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi una nota in evidenza o un consiglio..."
              className="flex-1 bg-transparent resize-none border-none outline-none text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed placeholder:text-neutral-400"
            />
          </div>
        )}

        {/* Quote Block */}
        {block.type === 'quote' && (
          <div className="my-2 pl-3 border-l-2 border-neutral-300 dark:border-neutral-600">
            <textarea
              ref={textareaRef}
              data-block-id={block.id}
              rows={1}
              value={block.content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Inserisci una citazione..."
              className="w-full bg-transparent resize-none border-none outline-none italic text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed placeholder:text-neutral-400"
            />
          </div>
        )}

        {/* Cross-workspace page links (Always open in a separate tab, two icons: workspace icon & page icon, no link icon) */}
        {crossWsMatches.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 select-none">
            {crossWsMatches.map((m, idx) => {
              const link = resolveCrossWorkspaceLink(m.wsName, m.noteTitle);
              return (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100/90 hover:bg-neutral-200/90 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 border border-neutral-200/80 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 transition-colors shadow-2xs group/crossLink hover:border-neutral-300 dark:hover:border-neutral-600 cursor-pointer"
                  title={`Apri "${link.noteTitle}" (${link.workspaceName}) in una nuova scheda`}
                >
                  {/* Icona del workspace sulla sinistra del nome workspace */}
                  <span className="text-xs shrink-0 select-none leading-none">{link.workspaceIcon}</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">{link.workspaceName}</span>

                  {/* Separatore */}
                  <span className="text-neutral-400 dark:text-neutral-500 font-normal select-none">/</span>

                  {/* Icona della pagina sulla sinistra del nome pagina */}
                  <span className="text-xs shrink-0 select-none leading-none">{link.noteIcon}</span>
                  <span className="truncate max-w-[200px] text-neutral-700 dark:text-neutral-300 group-hover/crossLink:underline">
                    {link.noteTitle}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Note, SyncStatus } from '../types/note';
import { EmojiPicker } from './EmojiPicker';
import { CoverPickerModal } from './CoverPickerModal';
import {
  Star,
  Trash2,
  Download,
  Image as ImageIcon,
  Smile,
  Cloud,
  CloudUpload,
  CloudOff,
  Menu,
} from 'lucide-react';

interface EditorHeaderProps {
  note: Note;
  syncStatus: SyncStatus;
  isLoggedIn: boolean;
  onUpdateNote: (fields: Partial<Note>) => void;
  onDeleteNote: (noteId: string) => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  note,
  syncStatus,
  isLoggedIn,
  onUpdateNote,
  onDeleteNote,
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [isHoveringCover, setIsHoveringCover] = useState(false);

  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize title textarea and prevent any internal scroll overflow
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [note.title]);

  const handleExportMarkdown = () => {
    let md = `# ${note.title || 'Senza titolo'}\n\n`;
    note.blocks.forEach((b) => {
      if (b.type === 'heading1') md += `# ${b.content}\n\n`;
      else if (b.type === 'heading2') md += `## ${b.content}\n\n`;
      else if (b.type === 'heading3') md += `### ${b.content}\n\n`;
      else if (b.type === 'todo')
        md += `- [${b.completed ? 'x' : ' '}] ${b.content}\n`;
      else if (b.type === 'code')
        md += `\`\`\`${b.language || ''}\n${b.content}\n\`\`\`\n\n`;
      else if (b.type === 'image')
        md += `![${b.caption || 'Immagine'}](${b.content})\n\n`;
      else if (b.type === 'file')
        md += `[Allegato: ${b.fileName || 'File'}](${b.fileUrl || '#'})\n\n`;
      else if (b.type === 'quote') md += `> ${b.content}\n\n`;
      else if (b.type === 'callout') md += `> 💡 ${b.content}\n\n`;
      else md += `${b.content}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${note.title || 'nota'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-full">
      {/* Top sticky action bar */}
      <div
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderBottomColor: 'var(--theme-border)',
          color: 'var(--theme-text-main)',
        }}
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-2.5 border-b backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            style={{ color: 'var(--theme-text-muted)' }}
            className="p-1.5 rounded-lg hover:text-[var(--theme-text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={isSidebarOpen ? 'Nascondi barra laterale' : 'Mostra barra laterale'}
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Sync status indicator */}
          <div
            style={{ color: 'var(--theme-text-muted)' }}
            className="flex items-center gap-1.5 text-xs"
          >
            {syncStatus === 'saving' ? (
              <>
                <CloudUpload className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span className="font-mono text-[11px]">Salvataggio...</span>
              </>
            ) : syncStatus === 'synced' && isLoggedIn ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-mono text-[11px]">Cloud sincronizzato</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-mono text-[11px]">Salvato in locale</span>
              </>
            )}
          </div>
        </div>

        {/* Right action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdateNote({ isFavorite: !note.isFavorite })}
            style={note.isFavorite ? { color: '#f59e0b' } : { color: 'var(--theme-text-muted)' }}
            className={`p-1.5 rounded-lg transition-colors hover:text-[var(--theme-text-main)] hover:bg-black/5 dark:hover:bg-white/5 ${
              note.isFavorite ? 'hover:bg-amber-50 dark:hover:bg-amber-950/30' : ''
            }`}
            title={note.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          >
            <Star className={`w-4 h-4 ${note.isFavorite ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={handleExportMarkdown}
            style={{ color: 'var(--theme-text-muted)' }}
            className="p-1.5 rounded-lg hover:text-[var(--theme-text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Esporta nota (.md)"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (window.confirm('Vuoi davvero eliminare questa nota?')) {
                onDeleteNote(note.id);
              }
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Elimina nota"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

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
      <div className="max-w-3xl mx-auto px-12 pt-4 pb-2">
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
            if (e.key === 'Enter') {
              e.preventDefault();
              const firstBlock = document.querySelector<HTMLTextAreaElement>(
                '[data-block-id]:not([data-block-id="note-title"])'
              );
              firstBlock?.focus();
            }
          }}
          placeholder="Senza titolo"
          style={{ color: 'var(--theme-text-main)' }}
          className="w-full font-display text-4xl font-extrabold tracking-tight bg-transparent border-none outline-none resize-none overflow-hidden block p-0 m-0 leading-tight"
        />

        {/* Metadata info */}
        <div
          style={{ color: 'var(--theme-text-muted)' }}
          className="flex items-center gap-2 mt-2 text-xs font-mono"
        >
          <span>
            Ultima modifica{' '}
            {new Date(note.updatedAt).toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span aria-hidden="true">·</span>
          <span>{note.blocks.length} blocchi</span>
        </div>
      </div>
    </div>
  );
};

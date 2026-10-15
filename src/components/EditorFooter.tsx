import React from 'react';
import { Note, SyncStatus } from '../types/note';
import { ContentWidthDropdown } from './ContentWidthDropdown';
import {
  FALLBACK_DEFAULT_WIDTH,
  ConcreteContentWidth,
} from '../lib/contentWidth';
import {
  Star,
  Trash2,
  Download,
  Cloud,
  CloudUpload,
  CloudOff,
  Menu,
} from 'lucide-react';

interface EditorFooterProps {
  note?: Note | null;
  syncStatus: SyncStatus;
  isLoggedIn: boolean;
  isSidebarOpen: boolean;
  defaultContentWidth?: ConcreteContentWidth;
  onToggleSidebar: () => void;
  onUpdateNote?: (fields: Partial<Note>) => void;
  onDeleteNote?: (noteId: string) => void;
  onSetDefaultContentWidth?: (width: ConcreteContentWidth) => void;
}

export const EditorFooter: React.FC<EditorFooterProps> = ({
  note,
  syncStatus,
  isLoggedIn,
  isSidebarOpen,
  defaultContentWidth,
  onToggleSidebar,
  onUpdateNote,
  onDeleteNote,
  onSetDefaultContentWidth,
}) => {
  const handleExportMarkdown = () => {
    if (!note) return;

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
    <footer
      style={{
        backgroundColor: 'var(--theme-bg-sidebar)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text-main)',
      }}
      className="h-10 px-4 border-t flex items-center justify-between text-xs shrink-0 z-20 select-none"
    >
      {/* Left section: Sidebar toggle & sync status */}
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
          className="flex items-center gap-1.5 text-xs font-mono"
        >
          {syncStatus === 'saving' ? (
            <>
              <CloudUpload className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span className="text-[11px]">Salvataggio...</span>
            </>
          ) : syncStatus === 'synced' && isLoggedIn ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px]">Cloud sincronizzato</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-[11px]">Salvato in locale</span>
            </>
          )}
        </div>

        {/* Note metadata info */}
        {note && (
          <div
            style={{ color: 'var(--theme-text-muted)' }}
            className="flex items-center gap-1.5 text-[11px] font-mono select-none"
          >
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>
              Ultima modifica{' '}
              {new Date(note.updatedAt).toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>{note.blocks.length} blocchi</span>
          </div>
        )}
      </div>

      {/* Right section: Note action controls */}
      {note && (
        <div className="flex items-center gap-1">
          {/* Content width expansion option */}
          <ContentWidthDropdown
            currentSetting={note.contentWidth}
            defaultWidth={defaultContentWidth || FALLBACK_DEFAULT_WIDTH}
            onSelectWidth={(width) => onUpdateNote?.({ contentWidth: width })}
            onSetDefaultWidth={(width) => onSetDefaultContentWidth?.(width)}
          />

          <button
            onClick={() => onUpdateNote?.({ isFavorite: !note.isFavorite })}
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
                onDeleteNote?.(note.id);
              }
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Elimina nota"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </footer>
  );
};

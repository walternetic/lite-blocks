import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Note, WorkspaceMeta, WorkspaceStatus } from '../types/note';
import { User } from 'firebase/auth';
import { WorkspaceSelector } from './WorkspaceSelector';
import { getFullTabMemoryFootprint } from '../lib/memoryDiagnostics';
import {
  Search,
  Star,
  Trash2,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronDown,
  X,
  FileText,
  Cpu,
} from 'lucide-react';

export interface SidebarHandle {
  focusSearch: () => void;
}

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onToggleFavorite: (noteId: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isOpen: boolean;
  onCloseSidebar: () => void;
  currentUser: User | null;
  onLogin: () => void;
  onLogout: () => void;
  // Workspace integration
  workspaces: WorkspaceMeta[];
  activeWorkspaceId: string;
  workspaceStatus: WorkspaceStatus;
  workspaceStatusMap?: Record<string, WorkspaceStatus>;
  loadedWorkspaces?: Record<string, { notes: Note[]; status: WorkspaceStatus }>;
  onSelectWorkspaceInPlace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string, icon: string) => void;
  onUpdateWorkspace: (workspaceId: string, name: string, icon: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onUnloadWorkspace: (workspaceId?: string) => void;
  onOpenGlobalSearch: (initialQuery?: string) => void;
  onOpenMemoryDiagnostics: () => void;
}

export const Sidebar = forwardRef<SidebarHandle, SidebarProps>(
  (
    {
      notes,
      activeNoteId,
      onSelectNote,
      onDeleteNote,
      onToggleFavorite,
      isDarkMode,
      onToggleDarkMode,
      isOpen,
      onCloseSidebar,
      currentUser,
      onLogin,
      onLogout,
      workspaces,
      activeWorkspaceId,
      workspaceStatus,
      workspaceStatusMap,
      loadedWorkspaces,
      onSelectWorkspaceInPlace,
      onCreateWorkspace,
      onUpdateWorkspace,
      onDeleteWorkspace,
      onUnloadWorkspace,
      onOpenGlobalSearch,
      onOpenMemoryDiagnostics,
    },
    ref
  ) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isFavoritesOpen, setIsFavoritesOpen] = useState(true);
    const [isAllOpen, setIsAllOpen] = useState(true);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const tabFootprint = React.useMemo(() => {
      return getFullTabMemoryFootprint(notes, workspaceStatus);
    }, [notes, workspaceStatus]);

    useImperativeHandle(ref, () => ({
      focusSearch: () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      },
    }));

    const allFilteredNotes = React.useMemo(() => {
      return notes
        .filter((note) => {
          if (!searchQuery.trim()) return true;

          const q = searchQuery.toLowerCase();
          const titleMatch = note.title.toLowerCase().includes(q);
          const contentMatch = note.blocks.some((b) =>
            b.content?.toLowerCase().includes(q)
          );
          return titleMatch || contentMatch;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [notes, searchQuery]);

    const favoriteFilteredNotes = React.useMemo(() => {
      return allFilteredNotes.filter((note) => note.isFavorite);
    }, [allFilteredNotes]);

    const formatRelativeTime = (timestamp: number): string => {
      const diffSec = Math.floor((Date.now() - timestamp) / 1000);
      if (diffSec < 60) return 'ora';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}g`;
      return new Date(timestamp).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
      });
    };

    const renderNoteItem = (note: Note, keyPrefix: string) => {
      const isActive = note.id === activeNoteId;
      return (
        <div
          key={`${keyPrefix}${note.id}`}
          onClick={() => onSelectNote(note.id)}
          className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
            isActive
              ? 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            <span className="text-sm shrink-0">
              {note.icon || '📄'}
            </span>
            <span className="truncate">
              {note.title.trim() || 'Senza titolo'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono tabular-nums text-neutral-400 group-hover:hidden">
              {formatRelativeTime(note.updatedAt)}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(note.id);
              }}
              className={`p-1 rounded hover:bg-neutral-300/50 dark:hover:bg-neutral-700 transition-colors ${
                note.isFavorite
                  ? 'text-amber-500'
                  : 'text-neutral-400 opacity-0 group-hover:opacity-100'
              }`}
              title={note.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  note.isFavorite ? 'fill-current' : ''
                }`}
              />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Vuoi eliminare questa nota?')) {
                  onDeleteNote(note.id);
                }
              }}
              className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
              title="Elimina nota"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Alt + Enter: invoke global cross-workspace search with the query!
      if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        onOpenGlobalSearch(searchQuery);
      }
    };

    return (
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-72 bg-[#fbfbfa] dark:bg-[#1f1f1f] border-r border-[#ececeb] dark:border-[#2e2e2e] flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
      >
        {/* Top Header: Workspace Selector takes place of the old brand header */}
        <div className="flex items-center gap-1.5 p-2.5 border-b border-[#ececeb] dark:border-[#2e2e2e]">
          <div className="flex-1 min-w-0">
            <WorkspaceSelector
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              workspaceStatus={workspaceStatus}
              loadedNotesCount={notes.length}
              workspaceStatusMap={workspaceStatusMap}
              loadedWorkspaces={loadedWorkspaces}
              onSelectWorkspaceInPlace={onSelectWorkspaceInPlace}
              onCreateWorkspace={onCreateWorkspace}
              onUpdateWorkspace={onUpdateWorkspace}
              onDeleteWorkspace={onDeleteWorkspace}
              onUnloadWorkspace={onUnloadWorkspace}
            />
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={onToggleDarkMode}
              className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              title={isDarkMode ? 'Tema Chiaro' : 'Tema Scuro'}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onCloseSidebar}
              className="md:hidden p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              title="Chiudi barra"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Standard Search Bar (Ctrl+K focused, Alt+Enter for global search) */}
        <div className="px-2.5 pt-2.5 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-neutral-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              disabled={workspaceStatus === 'unloaded'}
              placeholder="Cerca (⌘K) · Alt+↵ globale"
              className="w-full pl-8 pr-12 py-1.5 text-xs bg-white dark:bg-neutral-800/80 border border-[#e5e5e4] dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 disabled:opacity-40"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-2 top-2 text-[10px] font-mono text-neutral-400 pointer-events-none">
                ⌘K
              </span>
            )}
          </div>
        </div>

        {/* Accordion Notes List / Unloaded State */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {workspaceStatus === 'unloaded' ? (
            <div className="p-4 my-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-100/50 dark:bg-neutral-800/40 text-center">
              <span className="text-xl block mb-1">💤</span>
              <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Workspace a riposo
              </h4>
              <p className="text-[11px] text-neutral-400 mb-3">
                Memoria RAM liberata.
              </p>
              <button
                onClick={() => onSelectWorkspaceInPlace(activeWorkspaceId)}
                className="px-3 py-1.5 text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg shadow-2xs"
              >
                Carica in memoria
              </button>
            </div>
          ) : (
            <>
              {/* Accordion Section: Preferite */}
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setIsFavoritesOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-transform duration-200 ${
                        isFavoritesOpen ? '' : '-rotate-90'
                      }`}
                    />
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Preferite</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                    {favoriteFilteredNotes.length}
                  </span>
                </button>

                {isFavoritesOpen && (
                  <div className="space-y-0.5 pt-0.5">
                    {favoriteFilteredNotes.length === 0 ? (
                      <div className="px-3 py-1.5 text-[11px] text-neutral-400 italic">
                        {searchQuery ? 'Nessun preferito trovato' : 'Nessuna nota nei preferiti'}
                      </div>
                    ) : (
                      favoriteFilteredNotes.map((note) => renderNoteItem(note, 'fav-'))
                    )}
                  </div>
                )}
              </div>

              {/* Accordion Section: Tutte */}
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setIsAllOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-transform duration-200 ${
                        isAllOpen ? '' : '-rotate-90'
                      }`}
                    />
                    <FileText className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
                    <span>Tutte</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                    {allFilteredNotes.length}
                  </span>
                </button>

                {isAllOpen && (
                  <div className="space-y-0.5 pt-0.5">
                    {allFilteredNotes.length === 0 ? (
                      <div className="px-3 py-3 text-center text-xs text-neutral-400">
                        {searchQuery ? (
                          `Nessuna nota trovata per "${searchQuery}"`
                        ) : (
                          <div>
                            <span>Nessuna nota presente.</span>
                            <span className="block mt-1 font-mono text-[11px] text-neutral-400">
                              Premi Ctrl+N per crearne una
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      allFilteredNotes.map((note) => renderNoteItem(note, 'all-'))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Compact Local / Cloud Sync & Memory Diagnostics Footer */}
        <div className="px-3 py-2 border-t border-[#ececeb] dark:border-[#2e2e2e] bg-[#f7f7f6] dark:bg-[#1a1a1a] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {currentUser ? (
              <div
                className="flex items-center gap-1.5 min-w-0"
                title={`Cloud sincronizzato: ${currentUser.email || ''}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[11px] font-mono text-neutral-700 dark:text-neutral-300 truncate max-w-[100px]">
                  {currentUser.displayName || currentUser.email || 'Cloud'}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5"
                title="Salvataggio locale istantaneo attivo"
              >
                <span className="w-2 h-2 rounded-full bg-neutral-400 shrink-0" />
                <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                  Locale
                </span>
              </div>
            )}

            {/* Clickable Full Tab Memory Chip (Tutto compreso) */}
            <button
              onClick={onOpenMemoryDiagnostics}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              title={`Memoria effettiva scheda: ~${tabFootprint.formattedTotalRecoverable} recuperabili chiudendo il tab (Heap: ${tabFootprint.formattedJsHeapUsed}, Rendering/Media: ${tabFootprint.formattedDecodedBitmaps}, Dati: ${tabFootprint.formattedWorkspaceData}). Clicca per diagnostica dettagliata.`}
            >
              <Cpu className="w-3 h-3 text-neutral-400" />
              <span>~{tabFootprint.formattedTotalRecoverable}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!currentUser ? (
              <button
                onClick={onLogin}
                className="px-2 py-0.5 text-[11px] font-medium border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs"
                title="Accedi con Google per sincronizzare"
              >
                Accedi
              </button>
            ) : (
              <button
                onClick={onLogout}
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded"
                title="Esci dall'account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  }
);

Sidebar.displayName = 'Sidebar';

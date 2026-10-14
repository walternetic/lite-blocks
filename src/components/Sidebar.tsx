import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Note, WorkspaceMeta, WorkspaceStatus } from '../types/note';
import { User } from 'firebase/auth';
import { WorkspaceSelector } from './WorkspaceSelector';
import { ThemeDropdown } from './ThemeDropdown';
import { getFullTabMemoryFootprint } from '../lib/memoryDiagnostics';
import { APP_VERSION } from '../version';
import {
  Search,
  Star,
  Trash2,
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
  onCreateWorkspace: (name: string, icon: string, themeId?: string) => void;
  onUpdateWorkspace: (workspaceId: string, name: string, icon: string, themeId?: string) => void;
  onApplyTheme?: (themeId: string) => void;
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
      onApplyTheme,
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
          style={
            isActive
              ? {
                  backgroundColor: 'var(--theme-bg-surface)',
                  color: 'var(--theme-text-main)',
                  borderLeft: '3px solid var(--theme-accent)',
                }
              : {
                  color: 'var(--theme-text-muted)',
                }
          }
          className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-all ${
            isActive
              ? 'font-semibold shadow-xs'
              : 'hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--theme-text-main)]'
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
            <span
              style={{ color: 'var(--theme-text-muted)' }}
              className="text-[10px] font-mono tabular-nums group-hover:hidden"
            >
              {formatRelativeTime(note.updatedAt)}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(note.id);
              }}
              className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
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
        style={{
          backgroundColor: 'var(--theme-bg-sidebar)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-main)',
        }}
        className={`fixed md:static inset-y-0 left-0 z-30 w-72 border-r flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
      >
        {/* Top Header: Workspace Selector takes place of the old brand header */}
        <div
          style={{ borderColor: 'var(--theme-border)' }}
          className="flex items-center gap-1.5 p-2.5 border-b"
        >
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
            <ThemeDropdown
              activeThemeId={workspaces.find((w) => w.id === activeWorkspaceId)?.themeId}
              isDarkMode={isDarkMode}
              onToggleDarkMode={onToggleDarkMode}
              onSelectTheme={onApplyTheme || (() => {})}
            />
            <button
              onClick={onCloseSidebar}
              style={{ color: 'var(--theme-text-muted)' }}
              className="md:hidden p-1.5 rounded-md hover:text-[var(--theme-text-main)]"
              title="Chiudi barra"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Standard Search Bar (Ctrl+K focused, Alt+Enter for global search) */}
        <div className="px-2.5 pt-2.5 pb-1">
          <div className="relative">
            <Search
              style={{ color: 'var(--theme-text-muted)' }}
              className="absolute left-2.5 top-2.5 w-3.5 h-3.5"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              disabled={workspaceStatus === 'unloaded'}
              placeholder="Cerca (⌘K) · Alt+↵ globale"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-main)',
              }}
              className="w-full pl-8 pr-12 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] disabled:opacity-40"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                style={{ color: 'var(--theme-text-muted)' }}
                className="absolute right-2 top-2 hover:text-[var(--theme-text-main)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span
                style={{ color: 'var(--theme-text-muted)' }}
                className="absolute right-2 top-2 text-[10px] font-mono pointer-events-none"
              >
                ⌘K
              </span>
            )}
          </div>
        </div>

        {/* Accordion Notes List / Unloaded State */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {workspaceStatus === 'unloaded' ? (
            <div
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-surface)',
                color: 'var(--theme-text-main)',
              }}
              className="p-4 my-2 rounded-xl border border-dashed text-center"
            >
              <span className="text-xl block mb-1">💤</span>
              <h4 className="text-xs font-semibold mb-1">
                Workspace a riposo
              </h4>
              <p
                style={{ color: 'var(--theme-text-muted)' }}
                className="text-[11px] mb-3"
              >
                Memoria RAM liberata.
              </p>
              <button
                onClick={() => onSelectWorkspaceInPlace(activeWorkspaceId)}
                style={{
                  backgroundColor: 'var(--theme-accent)',
                  color: 'var(--theme-accent-text)',
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg shadow-2xs hover:opacity-90 transition-opacity"
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
                  style={{ color: 'var(--theme-text-muted)' }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium hover:text-[var(--theme-text-main)] rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isFavoritesOpen ? '' : '-rotate-90'
                      }`}
                    />
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Preferite</span>
                  </div>
                  <span
                    style={{
                      backgroundColor: 'var(--theme-bg-hover)',
                      color: 'var(--theme-text-muted)',
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  >
                    {favoriteFilteredNotes.length}
                  </span>
                </button>

                {isFavoritesOpen && (
                  <div className="space-y-0.5 pt-0.5">
                    {favoriteFilteredNotes.length === 0 ? (
                      <div
                        style={{ color: 'var(--theme-text-muted)' }}
                        className="px-3 py-1.5 text-[11px] italic"
                      >
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
                  style={{ color: 'var(--theme-text-muted)' }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium hover:text-[var(--theme-text-main)] rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isAllOpen ? '' : '-rotate-90'
                      }`}
                    />
                    <FileText className="w-3.5 h-3.5" />
                    <span>Tutte</span>
                  </div>
                  <span
                    style={{
                      backgroundColor: 'var(--theme-bg-hover)',
                      color: 'var(--theme-text-muted)',
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  >
                    {allFilteredNotes.length}
                  </span>
                </button>

                {isAllOpen && (
                  <div className="space-y-0.5 pt-0.5">
                    {allFilteredNotes.length === 0 ? (
                      <div
                        style={{ color: 'var(--theme-text-muted)' }}
                        className="px-3 py-3 text-center text-xs"
                      >
                        {searchQuery ? (
                          `Nessuna nota trovata per "${searchQuery}"`
                        ) : (
                          <div>
                            <span>Nessuna nota presente.</span>
                            <span className="block mt-1 font-mono text-[11px]">
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
        <div
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-sidebar)',
          }}
          className="px-3 py-2 border-t flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            {currentUser ? (
              <div
                className="flex items-center gap-1.5 min-w-0"
                title={`Cloud sincronizzato: ${currentUser.email || ''}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span
                  style={{ color: 'var(--theme-text-main)' }}
                  className="text-[11px] font-mono truncate max-w-[100px]"
                >
                  {currentUser.displayName || currentUser.email || 'Cloud'}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5"
                title="Salvataggio locale istantaneo attivo"
              >
                <span className="w-2 h-2 rounded-full bg-neutral-400 shrink-0" />
                <span
                  style={{ color: 'var(--theme-text-muted)' }}
                  className="text-[11px] font-mono"
                >
                  Locale
                </span>
              </div>
            )}

            {/* Clickable Full Tab Memory Chip (Tutto compreso) */}
            <button
              onClick={onOpenMemoryDiagnostics}
              style={{ color: 'var(--theme-text-muted)' }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono hover:text-[var(--theme-text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title={`Memoria effettiva scheda: ~${tabFootprint.formattedTotalRecoverable} recuperabili chiudendo il tab (Heap: ${tabFootprint.formattedJsHeapUsed}, Rendering/Media: ${tabFootprint.formattedDecodedBitmaps}, Dati: ${tabFootprint.formattedWorkspaceData}). Clicca per diagnostica dettagliata.`}
            >
              <Cpu className="w-3 h-3" />
              <span>~{tabFootprint.formattedTotalRecoverable}</span>
            </button>

            {/* Application SemVer Version Badge */}
            <span
              style={{
                color: 'var(--theme-text-muted)',
                backgroundColor: 'var(--theme-bg-hover)',
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono cursor-default select-none transition-colors hover:text-[var(--theme-text-main)]"
              title={`Versione applicazione: v${APP_VERSION} (SemVer 2.0.0)`}
            >
              v{APP_VERSION}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!currentUser ? (
              <button
                onClick={onLogin}
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-bg-surface)',
                  color: 'var(--theme-text-main)',
                }}
                className="px-2 py-0.5 text-[11px] font-medium border rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-2xs"
                title="Accedi con Google per sincronizzare"
              >
                Accedi
              </button>
            ) : (
              <button
                onClick={onLogout}
                style={{ color: 'var(--theme-text-muted)' }}
                className="p-1 hover:text-[var(--theme-text-main)] rounded transition-colors"
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

import React, { useState, useRef, useEffect } from 'react';
import { WorkspaceMeta, WorkspaceStatus, Note } from '../types/note';
import {
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Power,
  Database,
  ExternalLink,
} from 'lucide-react';
import { COMMON_EMOJIS } from '../lib/sampleData';
import { buildRouteUrl } from '../lib/urlRouting';

interface WorkspaceSelectorProps {
  workspaces: WorkspaceMeta[];
  activeWorkspaceId: string;
  workspaceStatus: WorkspaceStatus;
  loadedNotesCount: number;
  workspaceStatusMap?: Record<string, WorkspaceStatus>;
  loadedWorkspaces?: Record<string, { notes: Note[]; status: WorkspaceStatus }>;
  onSelectWorkspaceInPlace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string, icon: string) => void;
  onUpdateWorkspace: (workspaceId: string, name: string, icon: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onUnloadWorkspace: (workspaceId?: string) => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspaces,
  activeWorkspaceId,
  workspaceStatus,
  loadedNotesCount,
  workspaceStatusMap,
  loadedWorkspaces,
  onSelectWorkspaceInPlace,
  onCreateWorkspace,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onUnloadWorkspace,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingWsId, setEditingWsId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📁');

  const containerRef = useRef<HTMLDivElement>(null);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingWsId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartCreate = () => {
    setNewName('');
    setNewIcon(
      COMMON_EMOJIS[Math.floor(Math.random() * COMMON_EMOJIS.length)] || '📁'
    );
    setIsCreating(true);
    setEditingWsId(null);
  };

  const handleSaveCreate = () => {
    if (!newName.trim()) return;
    onCreateWorkspace(newName.trim(), newIcon);
    setIsCreating(false);
    setIsOpen(false);
  };

  const handleStartEdit = (ws: WorkspaceMeta) => {
    setEditingWsId(ws.id);
    setNewName(ws.name);
    setNewIcon(ws.icon);
    setIsCreating(false);
  };

  const handleSaveEdit = (wsId: string) => {
    if (!newName.trim()) return;
    onUpdateWorkspace(wsId, newName.trim(), newIcon);
    setEditingWsId(null);
  };

  const handleWorkspaceItemClick = (e: React.MouseEvent, wsId: string) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      // Shift or Meta/Ctrl click: open in a new tab with path route /w/:wsId
      e.preventDefault();
      window.open(buildRouteUrl(wsId), '_blank');
      return;
    }

    // Default: load in-line in the current tab!
    e.preventDefault();
    onSelectWorkspaceInPlace(wsId);
    setIsOpen(false);
  };

  // Helper to determine status of any workspace
  const getWsStatus = (wsId: string): WorkspaceStatus => {
    if (wsId === activeWorkspaceId) {
      return workspaceStatus;
    }
    if (workspaceStatusMap && workspaceStatusMap[wsId]) {
      return workspaceStatusMap[wsId];
    }
    if (loadedWorkspaces && loadedWorkspaces[wsId]) {
      return loadedWorkspaces[wsId].status;
    }
    return 'unloaded';
  };

  // Helper to determine loaded note count for any workspace
  const getWsNoteCount = (wsId: string): number => {
    if (wsId === activeWorkspaceId) {
      return workspaceStatus === 'active' ? loadedNotesCount : 0;
    }
    if (loadedWorkspaces && loadedWorkspaces[wsId] && loadedWorkspaces[wsId].status === 'active') {
      return loadedWorkspaces[wsId].notes.length;
    }
    return 0;
  };

  const activeWorkspacesCount = workspaces.filter(
    (w) => getWsStatus(w.id) === 'active'
  ).length;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Compact Clickable Workspace Indicator Card */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="cursor-pointer w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-[#ececeb] dark:border-[#2e2e2e] bg-white dark:bg-[#202020] hover:bg-neutral-100/90 dark:hover:bg-[#282828] hover:border-neutral-300 dark:hover:border-neutral-600 transition-all shadow-2xs group select-none min-h-[34px]"
        title="Clicca per aprire la lista dei workspace"
      >
        {/* Workspace Identity: Single-line compact layout with generous full-card hitbox */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-base shrink-0 leading-none select-none">
            {activeWorkspace?.icon || '📁'}
          </span>
          <span className="font-display font-semibold text-xs text-neutral-900 dark:text-neutral-100 group-hover:text-black dark:group-hover:text-white truncate">
            {activeWorkspace?.name || 'Workspace'}
          </span>
        </div>

        {/* Integrated Status & Unload/Load Button (Icon & Color only) + Chevron */}
        <div
          className="flex items-center gap-0.5 shrink-0 ml-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Status & Unload/Load Trigger Button - Icon and Color only */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (workspaceStatus === 'active') {
                onUnloadWorkspace(activeWorkspace.id);
              } else {
                onSelectWorkspaceInPlace(activeWorkspace.id);
              }
            }}
            className={`group/statusBtn flex items-center justify-center w-6 h-6 rounded-md transition-all ${
              workspaceStatus === 'active'
                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400'
                : 'text-neutral-400 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400'
            }`}
            title={
              workspaceStatus === 'active'
                ? `Attivo in RAM (${loadedNotesCount} note) · Clicca per scaricare (libera RAM)`
                : 'Dormiente (scaricato) · Clicca per caricare in memoria'
            }
          >
            {workspaceStatus === 'active' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] group-hover/statusBtn:hidden shrink-0" />
                <Power className="w-3.5 h-3.5 hidden group-hover/statusBtn:block text-amber-500 shrink-0" />
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-500 group-hover/statusBtn:hidden shrink-0" />
                <Database className="w-3.5 h-3.5 hidden group-hover/statusBtn:block text-emerald-500 shrink-0" />
              </>
            )}
          </button>

          {/* Dropdown Chevron */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
            title={isOpen ? 'Chiudi lista workspace' : 'Apri lista workspace'}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Workspace Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#202020] border border-[#ececeb] dark:border-[#2e2e2e] rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95 duration-100 text-xs">
          {/* Header info */}
          <div className="px-2 py-1 text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between border-b border-[#ececeb] dark:border-[#2e2e2e] pb-1.5 mb-1.5">
            <span className="font-medium">I tuoi Workspace ({workspaces.length})</span>
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {activeWorkspacesCount} in RAM
            </span>
          </div>

          {/* List of Workspaces */}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {workspaces.map((ws) => {
              const isSelected = ws.id === activeWorkspaceId;
              const isEditing = editingWsId === ws.id;
              const wsStatus = getWsStatus(ws.id);
              const isWsActive = wsStatus === 'active';
              const wsNoteCount = getWsNoteCount(ws.id);

              if (isEditing) {
                return (
                  <div
                    key={ws.id}
                    className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg space-y-1.5 text-xs"
                  >
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newIcon}
                        onChange={(e) => setNewIcon(e.target.value)}
                        maxLength={4}
                        className="w-8 px-1 text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs text-neutral-900 dark:text-neutral-100"
                      />
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="flex-1 px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditingWsId(null)}
                        className="px-2 py-0.5 rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[11px]"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={() => handleSaveEdit(ws.id)}
                        className="px-2 py-0.5 rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[11px] font-medium"
                      >
                        Salva
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={ws.id}
                  className={`group/item flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-neutral-200/90 dark:bg-neutral-700 font-semibold text-neutral-950 dark:text-white'
                      : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/80 hover:text-neutral-950 dark:hover:text-white'
                  }`}
                >
                  {/* Default click loads in-line; Shift+Click opens new tab */}
                  <button
                    type="button"
                    onClick={(e) => handleWorkspaceItemClick(e, ws.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left text-neutral-900 dark:text-neutral-100 group-hover/item:text-neutral-950 dark:group-hover/item:text-white py-0.5"
                    title="Clic: carica in questo tab · Shift+Clic: apri in nuova scheda"
                  >
                    <span className="text-base leading-none shrink-0">{ws.icon}</span>
                    <span className="truncate font-medium">{ws.name}</span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0 ml-1.5">
                    {/* Integrated Status (Active/Dormant) and Unload/Load Button - Color & Icon only */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isWsActive) {
                          onUnloadWorkspace(ws.id);
                        } else {
                          onSelectWorkspaceInPlace(ws.id);
                          setIsOpen(false);
                        }
                      }}
                      className={`group/statusItem flex items-center justify-center w-5 h-5 rounded transition-all ${
                        isWsActive
                          ? 'text-emerald-600 dark:text-emerald-400 hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400'
                          : 'text-neutral-400 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400'
                      }`}
                      title={
                        isWsActive
                          ? `Attivo in RAM (${wsNoteCount} note) · Clicca per scaricare`
                          : 'Dormiente (scaricato) · Clicca per caricare in memoria'
                      }
                    >
                      {isWsActive ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)] group-hover/statusItem:hidden shrink-0" />
                          <Power className="w-3 h-3 hidden group-hover/statusItem:block text-amber-500 shrink-0" />
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 group-hover/statusItem:hidden shrink-0" />
                          <Database className="w-3 h-3 hidden group-hover/statusItem:block text-emerald-500 shrink-0" />
                        </>
                      )}
                    </button>

                    {/* Dedicated Open in New Tab Button */}
                    <a
                      href={buildRouteUrl(ws.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-200/70 dark:hover:bg-neutral-600 rounded transition-colors"
                      title="Apri workspace in una nuova scheda"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    {/* Edit Workspace Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(ws);
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 opacity-0 group-hover/item:opacity-100 rounded transition-opacity"
                      title="Modifica nome e icona"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Delete Workspace Button */}
                    {workspaces.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `Sei sicuro di voler eliminare il workspace "${ws.name}"?`
                            )
                          ) {
                            onDeleteWorkspace(ws.id);
                          }
                        }}
                        className="p-1 text-neutral-400 hover:text-rose-600 opacity-0 group-hover/item:opacity-100 rounded transition-opacity"
                        title="Elimina workspace"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Create Workspace Inline Form or Trigger */}
          <div className="pt-1 mt-1 border-t border-[#ececeb] dark:border-[#2e2e2e]">
            {isCreating ? (
              <div className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg space-y-1.5 text-xs">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    maxLength={4}
                    placeholder="📁"
                    className="w-8 px-1 text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs text-neutral-900 dark:text-neutral-100"
                  />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome workspace..."
                    className="flex-1 px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs text-neutral-900 dark:text-neutral-100"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => setIsCreating(false)}
                    className="px-2 py-0.5 rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[11px]"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleSaveCreate}
                    disabled={!newName.trim()}
                    className="px-2 py-0.5 rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[11px] font-semibold disabled:opacity-40"
                  >
                    Crea
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleStartCreate}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700/80 rounded-lg transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5 text-neutral-500" />
                <span>Nuovo workspace</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

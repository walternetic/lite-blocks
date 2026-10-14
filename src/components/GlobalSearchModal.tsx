import React, { useState, useEffect, useRef } from 'react';
import { WorkspaceMeta } from '../types/note';
import {
  searchAcrossAllWorkspacesOnDemand,
  GlobalSearchResult,
} from '../lib/workspaceStorage';
import { Search, X, Layers, ArrowRight, CornerDownLeft } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  initialQuery?: string;
  workspaces: WorkspaceMeta[];
  onClose: () => void;
  onSelectResult: (workspaceId: string, noteId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  initialQuery = '',
  workspaces,
  onClose,
  onSelectResult,
}) => {
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(initialQuery);
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialQuery]);

  // On-demand search query with debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchAcrossAllWorkspacesOnDemand(searchTerm, workspaces);
      setResults(res);
      setIsSearching(false);
      setSelectedIndex(0);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, workspaces]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (results.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? (results.length || 1) - 1 : prev - 1
        );
      } else if (e.key === 'Enter') {
        if (results[selectedIndex]) {
          e.preventDefault();
          const target = results[selectedIndex];
          onSelectResult(target.workspaceId, target.noteId);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose, onSelectResult]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100 dark:border-neutral-700">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca su tutti i workspace (titolo, to-do, codice, testo)..."
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 border-none outline-none placeholder:text-neutral-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 text-neutral-400 hover:text-neutral-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-700 text-neutral-500 px-1.5 py-0.5 rounded">
            ESC
          </span>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-2">
          {isSearching ? (
            <div className="py-8 text-center text-xs text-neutral-400 font-mono">
              Scansione on-demand di tutti i workspace in corso...
            </div>
          ) : searchTerm && results.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              Nessun risultato trovato nei workspace per "{searchTerm}"
            </div>
          ) : !searchTerm ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              Digita per eseguire una ricerca isolata on-demand su tutti i workspace.
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item.workspaceId}-${item.noteId}-${idx}`}
                    onClick={() => {
                      onSelectResult(item.workspaceId, item.noteId);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-start justify-between p-3 rounded-xl text-left transition-colors ${
                      isSelected
                        ? 'bg-neutral-100 dark:bg-neutral-700/80 text-neutral-900 dark:text-white'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Workspace pill */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-neutral-200/70 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
                          <span>{item.workspaceIcon}</span>
                          <span>{item.workspaceName}</span>
                        </span>

                        <span className="text-neutral-300 dark:text-neutral-600">/</span>

                        <span className="font-semibold text-xs truncate">
                          {item.noteIcon || '📄'} {item.noteTitle}
                        </span>
                      </div>

                      {item.matchSnippet && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate pl-1">
                          {item.matchSnippet}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-1 text-[11px] text-neutral-400 mt-1">
                      <span className="font-mono tabular-nums">
                        {new Date(item.updatedAt).toLocaleDateString('it-IT', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-blue-500 ml-1" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 dark:bg-neutral-900/60 border-t border-neutral-100 dark:border-neutral-700 text-[11px] text-neutral-400">
          <span>
            {workspaces.length} workspace registrati · Ricerca on-demand senza ritenzione in RAM
          </span>
          <div className="flex items-center gap-3">
            <span>↑↓ per navigare</span>
            <span>↵ per selezionare</span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { getWorkspacesManifest, loadPartitionNotes } from '../lib/workspaceStorage';
import { Note, WorkspaceMeta } from '../types/note';
import { X, ExternalLink, Link2, Trash2, Check } from 'lucide-react';
import { AutocompleteCombobox, AutocompleteItem } from './AutocompleteCombobox';

interface PageLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWsName?: string;
  initialNoteTitle?: string;
  initialCustomLabel?: string;
  onSave: (newWsName: string, newNoteTitle?: string, newCustomLabel?: string) => void;
  onDeleteLink?: () => void;
}

export const PageLinkModal: React.FC<PageLinkModalProps> = ({
  isOpen,
  onClose,
  initialWsName,
  initialNoteTitle,
  initialCustomLabel,
  onSave,
  onDeleteLink,
}) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [selectedWsId, setSelectedWsId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteTitle, setSelectedNoteTitle] = useState<string>('');
  const [customLabel, setCustomLabel] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const allWs = getWorkspacesManifest();
    setWorkspaces(allWs);

    // Match initial workspace by name or id, or fallback to first workspace
    const matchedWs = (initialWsName
      ? allWs.find(
          (w) =>
            w.name.toLowerCase() === initialWsName.toLowerCase() ||
            w.id.toLowerCase() === initialWsName.toLowerCase()
        )
      : null) || allWs[0];

    const currentWsId = matchedWs?.id || '';
    setSelectedWsId(currentWsId);
    setSelectedNoteTitle(initialNoteTitle || '');
    setCustomLabel(initialCustomLabel || '');

    if (currentWsId) {
      const wsNotes = loadPartitionNotes(currentWsId);
      setNotes(wsNotes);
    }
  }, [isOpen, initialWsName, initialNoteTitle, initialCustomLabel]);

  // When workspace selection changes, reload its notes
  const handleWorkspaceChange = (newWsId: string) => {
    setSelectedWsId(newWsId);
    const wsNotes = loadPartitionNotes(newWsId);
    setNotes(wsNotes);
    setSelectedNoteTitle('');
  };

  const handleSave = () => {
    const ws = workspaces.find((w) => w.id === selectedWsId);
    const targetWsName = ws ? ws.name : selectedWsId;
    onSave(targetWsName, selectedNoteTitle.trim() || undefined, customLabel.trim() || undefined);
    onClose();
  };

  if (!isOpen) return null;

  const workspaceItems: AutocompleteItem[] = workspaces.map((w) => ({
    id: w.id,
    label: w.name,
    icon: w.icon,
  }));

  const noteItems: AutocompleteItem[] = notes.map((n) => ({
    id: n.id,
    label: n.title,
    icon: n.icon || '📄',
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-main)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-[var(--theme-accent)]">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Modifica Link a Pagina</h3>
              <p style={{ color: 'var(--theme-text-muted)' }} className="text-[11px]">
                Imposta destinazione ed etichetta del collegamento inline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--theme-text-muted)' }}
            className="p-1 rounded-md hover:text-[var(--theme-text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-3.5 text-xs">
          {/* Workspace Destination Autocomplete */}
          <AutocompleteCombobox
            label="Spazio di lavoro (Workspace)"
            placeholder="Cerca workspace..."
            items={workspaceItems}
            selectedId={selectedWsId}
            onSelect={(item) => handleWorkspaceChange(item.id)}
          />

          {/* Page Target Autocomplete */}
          <AutocompleteCombobox
            label="Pagina / Nota di destinazione"
            placeholder={notes.length > 0 ? "Cerca o digita titolo nota..." : "Nessuna nota trovata (digita per creare)..."}
            items={noteItems}
            selectedId={selectedNoteTitle}
            allowCustomInput={true}
            onSelect={(item) => setSelectedNoteTitle(item.label)}
            onCustomChange={(val) => setSelectedNoteTitle(val)}
          />

          {/* Custom Display Label (Optional) */}
          <div>
            <label style={{ color: 'var(--theme-text-muted)' }} className="block mb-1 font-medium text-[11px]">
              Testo visualizzato personalizzato (Opzionale)
            </label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={selectedNoteTitle ? `Default: ${selectedNoteTitle}` : 'Lascia vuoto per usare il titolo della nota'}
              style={{
                backgroundColor: 'var(--theme-bg-app)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-main)',
              }}
              className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          {onDeleteLink ? (
            <button
              onClick={() => {
                onDeleteLink();
                onClose();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors font-medium"
              title="Rimuovi questo collegamento"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Rimuovi link</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              style={{ color: 'var(--theme-text-muted)' }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              style={{
                backgroundColor: 'var(--theme-accent)',
                color: 'var(--theme-accent-text)',
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg shadow-2xs hover:opacity-90 transition-opacity"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Salva modifiche</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

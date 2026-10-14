import { Note, WorkspaceMeta } from '../types/note';
import {
  INITIAL_WORKSPACES,
  INITIAL_NOTES,
  SAMPLE_DEV_NOTES,
  SAMPLE_IDEAS_NOTES,
} from './sampleData';
import { buildRouteUrl } from './urlRouting';

const MANIFEST_KEY = 'liteblocks_workspaces_manifest_v1';
const NOTE_STORAGE_PREFIX = 'liteblocks_ws_';

export interface ResolvedCrossWsLink {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon: string;
  noteId?: string;
  noteTitle: string;
  noteIcon: string;
  url: string;
}

export interface GlobalSearchResult {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon: string;
  noteId: string;
  noteTitle: string;
  noteIcon?: string;
  matchSnippet: string;
  updatedAt: number;
}

// Read workspace metadata manifest (ultra-lightweight, just IDs, names, icons)
export function getWorkspacesManifest(): WorkspaceMeta[] {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read workspaces manifest:', e);
  }
  // Initialize default workspaces
  saveWorkspacesManifest(INITIAL_WORKSPACES);
  return INITIAL_WORKSPACES;
}

export function saveWorkspacesManifest(workspaces: WorkspaceMeta[]): void {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(workspaces));
  } catch (e) {
    console.error('Failed to save workspaces manifest:', e);
  }
}

// Load notes strictly for ONE workspace partition (O(N_workspace) memory footprint)
export function loadPartitionNotes(workspaceId: string): Note[] {
  const key = `${NOTE_STORAGE_PREFIX}${workspaceId}_notes`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Failed to load notes for workspace ${workspaceId}:`, e);
  }

  // First-time seed for initial sample workspaces
  if (workspaceId === 'ws-personal') {
    savePartitionNotes(workspaceId, INITIAL_NOTES);
    return INITIAL_NOTES;
  } else if (workspaceId === 'ws-dev') {
    savePartitionNotes(workspaceId, SAMPLE_DEV_NOTES);
    return SAMPLE_DEV_NOTES;
  } else if (workspaceId === 'ws-ideas') {
    savePartitionNotes(workspaceId, SAMPLE_IDEAS_NOTES);
    return SAMPLE_IDEAS_NOTES;
  }

  return [];
}

// Save notes strictly to the active workspace partition
export function savePartitionNotes(workspaceId: string, notes: Note[]): void {
  const key = `${NOTE_STORAGE_PREFIX}${workspaceId}_notes`;
  try {
    localStorage.setItem(key, JSON.stringify(notes));
  } catch (e) {
    console.error(`Failed to save notes for workspace ${workspaceId}:`, e);
  }
}

// Delete workspace partition
export function deleteWorkspacePartition(workspaceId: string): void {
  const key = `${NOTE_STORAGE_PREFIX}${workspaceId}_notes`;
  localStorage.removeItem(key);
}

// On-demand search across all workspaces: reads partitions sequentially, extracts snippets,
// and does NOT retain notes in memory.
export async function searchAcrossAllWorkspacesOnDemand(
  searchTerm: string,
  workspaces: WorkspaceMeta[]
): Promise<GlobalSearchResult[]> {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return [];

  const results: GlobalSearchResult[] = [];

  for (const ws of workspaces) {
    const notes = loadPartitionNotes(ws.id);
    for (const note of notes) {
      const titleMatch = note.title.toLowerCase().includes(term);
      let matchSnippet = '';

      if (titleMatch) {
        matchSnippet = `Corrispondenza nel titolo della nota: "${note.title}"`;
      } else {
        const matchingBlock = note.blocks.find(
          (b) => b.content && b.content.toLowerCase().includes(term)
        );
        if (matchingBlock) {
          const idx = matchingBlock.content.toLowerCase().indexOf(term);
          const start = Math.max(0, idx - 30);
          const end = Math.min(matchingBlock.content.length, idx + term.length + 40);
          matchSnippet = (start > 0 ? '...' : '') + matchingBlock.content.slice(start, end) + (end < matchingBlock.content.length ? '...' : '');
        }
      }

      if (titleMatch || matchSnippet) {
        results.push({
          workspaceId: ws.id,
          workspaceName: ws.name,
          workspaceIcon: ws.icon,
          noteId: note.id,
          noteTitle: note.title || 'Senza titolo',
          noteIcon: note.icon,
          matchSnippet,
          updatedAt: note.updatedAt,
        });
      }
    }
  }

  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

// Resolve cross-workspace link details for navigation and rendering (workspace icon, page icon, title, url)
export function resolveCrossWorkspaceLink(
  wsNameOrId: string,
  noteTitleOrId?: string
): ResolvedCrossWsLink {
  const manifests = getWorkspacesManifest();
  const q = wsNameOrId.toLowerCase().trim();
  const targetWs = manifests.find(
    (w) => w.id.toLowerCase() === q || w.name.toLowerCase() === q
  );

  const wsId = targetWs ? targetWs.id : wsNameOrId;
  const wsName = targetWs ? targetWs.name : wsNameOrId;
  const wsIcon = targetWs ? targetWs.icon : '📁';

  const targetNotes = loadPartitionNotes(wsId);
  let matchedNote: Note | undefined = undefined;

  if (noteTitleOrId) {
    const nQ = noteTitleOrId.toLowerCase().trim();
    matchedNote = targetNotes.find(
      (n) =>
        n.id.toLowerCase() === nQ ||
        n.title.toLowerCase().trim() === nQ ||
        n.title.toLowerCase().trim().includes(nQ)
    );
  }

  // If no note was specified or found, fallback to the first note of that workspace
  const finalNote =
    matchedNote ||
    (!noteTitleOrId && targetNotes.length > 0 ? targetNotes[0] : undefined);

  let rawTitle = finalNote?.title || noteTitleOrId || wsName;
  let noteIcon = finalNote?.icon || '📄';

  // If title ends with the exact emoji of noteIcon, remove the redundant duplicate emoji
  if (noteIcon && rawTitle.endsWith(noteIcon)) {
    rawTitle = rawTitle.slice(0, -noteIcon.length).trim();
  }

  const url = buildRouteUrl(wsId, finalNote?.id, finalNote?.title);

  return {
    workspaceId: wsId,
    workspaceName: wsName,
    workspaceIcon: wsIcon,
    noteId: finalNote?.id,
    noteTitle: rawTitle,
    noteIcon: noteIcon,
    url,
  };
}

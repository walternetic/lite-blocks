/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note, NoteBlock, BlockType, SyncStatus, WorkspaceMeta, WorkspaceStatus } from './types/note';
import { Sidebar, SidebarHandle } from './components/Sidebar';
import { EditorHeader } from './components/EditorHeader';
import { BlockRenderer } from './components/BlockRenderer';
import { LightboxModal } from './components/LightboxModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { MemoryDiagnosticsModal } from './components/MemoryDiagnosticsModal';
import {
  getWorkspacesManifest,
  saveWorkspacesManifest,
  loadPartitionNotes,
  savePartitionNotes,
  deleteWorkspacePartition,
  resolveCrossWorkspaceLink,
} from './lib/workspaceStorage';
import {
  parseRouteUrl,
  syncBrowserUrl,
  generateUuid,
} from './lib/urlRouting';
import {
  auth,
  db,
  loginWithGoogle,
  logoutUser,
  onAuthStateChanged,
  testConnection,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import { User } from 'firebase/auth';
import { Plus, FileText, Database, Power, Globe } from 'lucide-react';

const ACTIVE_WS_KEY = 'liteblocks_active_ws_id_v1';
const THEME_KEY = 'liteblocks_theme_v1';

export default function App() {
  const sidebarRef = useRef<SidebarHandle>(null);

  // Workspaces Manifest (ultra-lightweight metadata list)
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>(() => {
    return getWorkspacesManifest();
  });

  // Parse initial route from URL path (/w/:wsId/p/:pageId#slug)
  const initialRouteRef = useRef(parseRouteUrl());

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    const route = initialRouteRef.current;
    const manifests = getWorkspacesManifest();
    if (route.workspaceId && manifests.some((w) => w.id === route.workspaceId)) {
      return route.workspaceId;
    }
    const saved = localStorage.getItem(ACTIVE_WS_KEY);
    if (saved && manifests.some((w) => w.id === saved)) {
      return saved;
    }
    return manifests[0]?.id || 'ws-personal';
  });

  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>('active');
  const [workspaceStatusMap, setWorkspaceStatusMap] = useState<Record<string, WorkspaceStatus>>(() => ({
    [activeWorkspaceId]: 'active',
  }));

  // Notes state represents STRICTLY the active workspace's notes in RAM (O(N_active))
  const [notes, setNotes] = useState<Note[]>(() => {
    return loadPartitionNotes(activeWorkspaceId);
  });

  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => {
    const route = initialRouteRef.current;
    if (route.pageId) {
      const match = notes.find((n) => n.id === route.pageId);
      if (match) return match.id;
    }
    return notes[0]?.id || null;
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(THEME_KEY) === 'dark';
  });

  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);

  const [lightboxData, setLightboxData] = useState<{
    src: string;
    caption?: string;
  } | null>(null);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const knownCloudDocIds = useRef<Set<string>>(new Set());

  // In-memory session cache for visited workspaces:
  // Preserves notes in RAM, active note per workspace, and cursor/scroll state
  const workspaceCacheRef = useRef<Record<string, {
    notes: Note[];
    activeNoteId: string | null;
    status: WorkspaceStatus;
    cursorState?: {
      blockId: string;
      selectionStart: number;
      selectionEnd: number;
      scrollY: number;
    } | null;
  }>>({
    [activeWorkspaceId]: {
      notes,
      activeNoteId,
      status: workspaceStatus,
      cursorState: null,
    },
  });

  // Track the most recent active block and cursor selection offset in real-time
  const lastCursorRef = useRef<{
    blockId: string;
    selectionStart: number;
    selectionEnd: number;
    scrollY: number;
  }>({
    blockId: '',
    selectionStart: 0,
    selectionEnd: 0,
    scrollY: 0,
  });

  // Target cursor/scroll to restore on workspace/page change
  const restoreTargetRef = useRef<{
    blockId: string;
    selectionStart: number;
    selectionEnd: number;
    scrollY: number;
  } | null>(null);

  // Apply dark mode class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

  // Persist notes strictly to active workspace storage partition and sync with RAM cache
  useEffect(() => {
    if (workspaceStatus === 'active') {
      savePartitionNotes(activeWorkspaceId, notes);
      if (workspaceCacheRef.current[activeWorkspaceId]) {
        workspaceCacheRef.current[activeWorkspaceId].notes = notes;
      }
    }
  }, [notes, activeWorkspaceId, workspaceStatus]);

  // Keep activeNoteId updated in session cache and persist last active note per workspace
  useEffect(() => {
    if (workspaceCacheRef.current[activeWorkspaceId]) {
      workspaceCacheRef.current[activeWorkspaceId].activeNoteId = activeNoteId;
      if (activeNoteId) {
        localStorage.setItem(`liteblocks_last_note_${activeWorkspaceId}`, activeNoteId);
      }
    }
  }, [activeNoteId, activeWorkspaceId]);

  // Listen to document selection, focus, typing, and scroll to maintain exact cursor coordinates
  useEffect(() => {
    const handleCursorUpdate = () => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        const blockId = activeEl.getAttribute('data-block-id');
        if (blockId) {
          const inputEl = activeEl as HTMLTextAreaElement | HTMLInputElement;
          lastCursorRef.current = {
            blockId,
            selectionStart: inputEl.selectionStart ?? 0,
            selectionEnd: inputEl.selectionEnd ?? 0,
            scrollY: window.scrollY || document.documentElement.scrollTop || 0,
          };
        }
      }
    };

    const handleScrollUpdate = () => {
      lastCursorRef.current.scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    };

    document.addEventListener('selectionchange', handleCursorUpdate);
    document.addEventListener('focusin', handleCursorUpdate);
    document.addEventListener('keyup', handleCursorUpdate);
    document.addEventListener('click', handleCursorUpdate);
    window.addEventListener('scroll', handleScrollUpdate, { passive: true });

    return () => {
      document.removeEventListener('selectionchange', handleCursorUpdate);
      document.removeEventListener('focusin', handleCursorUpdate);
      document.removeEventListener('keyup', handleCursorUpdate);
      document.removeEventListener('click', handleCursorUpdate);
      window.removeEventListener('scroll', handleScrollUpdate);
    };
  }, []);

  // Restore cursor position and scroll coordinates when transitioning workspace/note
  useEffect(() => {
    if (!restoreTargetRef.current) return;
    const target = restoreTargetRef.current;
    restoreTargetRef.current = null;

    const timer = setTimeout(() => {
      if (typeof target.scrollY === 'number') {
        window.scrollTo({ top: target.scrollY, behavior: 'instant' });
      }
      if (target.blockId) {
        const el = document.querySelector(`[data-block-id="${target.blockId}"]`) as HTMLTextAreaElement | HTMLInputElement | null;
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(target.selectionStart, target.selectionEnd);
          } catch {
            // ignore if not supported
          }
        }
      }
    }, 45);

    return () => clearTimeout(timer);
  }, [activeWorkspaceId, activeNoteId]);

  // Mandatory Firestore connection test on boot
  useEffect(() => {
    testConnection();
  }, []);

  // Synchronize URL path on initial mount (/w/:wsId/p/:pageId#slug)
  useEffect(() => {
    const currentNote = notes.find((n) => n.id === activeNoteId);
    if (workspaceStatus === 'active') {
      syncBrowserUrl(activeWorkspaceId, activeNoteId, currentNote?.title, true);
    } else {
      syncBrowserUrl(activeWorkspaceId, null, undefined, true);
    }
  }, []);

  // Listen for browser Back/Forward navigation (popstate) with cache & cursor preservation
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteUrl();
      if (route.workspaceId && route.workspaceId !== activeWorkspaceId) {
        // Save current workspace state before leaving
        if (workspaceStatus === 'active') {
          savePartitionNotes(activeWorkspaceId, notes);
        }
        workspaceCacheRef.current[activeWorkspaceId] = {
          notes,
          activeNoteId,
          status: workspaceStatus,
          cursorState: { ...lastCursorRef.current },
        };

        // Load target workspace from session cache or partition
        let targetWsState = workspaceCacheRef.current[route.workspaceId];
        if (!targetWsState || targetWsState.status === 'unloaded' || targetWsState.notes.length === 0) {
          const loaded = loadPartitionNotes(route.workspaceId);
          const savedLastNoteId = localStorage.getItem(`liteblocks_last_note_${route.workspaceId}`);
          const targetNote = route.pageId
            ? loaded.find((n) => n.id === route.pageId) || loaded[0] || null
            : (savedLastNoteId && loaded.find((n) => n.id === savedLastNoteId)) || loaded[0] || null;

          targetWsState = {
            notes: loaded,
            activeNoteId: targetNote?.id || null,
            status: 'active',
            cursorState: null,
          };
          workspaceCacheRef.current[route.workspaceId] = targetWsState;
        }

        const nextNotes = targetWsState.notes;
        const targetNoteId = route.pageId && nextNotes.some((n) => n.id === route.pageId)
          ? route.pageId
          : targetWsState.activeNoteId || nextNotes[0]?.id || null;

        restoreTargetRef.current = targetWsState.cursorState || null;

        setActiveWorkspaceId(route.workspaceId);
        localStorage.setItem(ACTIVE_WS_KEY, route.workspaceId);
        setWorkspaceStatus('active');
        setNotes(nextNotes);
        setActiveNoteId(targetNoteId);
      } else if (route.pageId && route.pageId !== activeNoteId) {
        setActiveNoteId(route.pageId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeWorkspaceId, activeNoteId, notes, workspaceStatus]);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Sync with Firestore when user is logged in: scoped STRICTLY to activeWorkspaceId
  useEffect(() => {
    if (!currentUser || workspaceStatus === 'unloaded') return;

    const notesCol = collection(db, 'notes');
    const q = query(
      notesCol,
      where('userId', '==', currentUser.uid),
      where('workspaceId', '==', activeWorkspaceId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const cloudNotes: Note[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          knownCloudDocIds.current.add(docSnap.id);
          cloudNotes.push({
            id: docSnap.id,
            workspaceId: data.workspaceId || activeWorkspaceId,
            userId: data.userId,
            title: data.title || '',
            icon: data.icon,
            coverUrl: data.coverUrl,
            isFavorite: !!data.isFavorite,
            createdAt:
              data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
            updatedAt:
              data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
            blocks: Array.isArray(data.blocks) ? data.blocks : [],
          });
        });

        if (cloudNotes.length > 0) {
          setNotes((prevNotes) => {
            const map = new Map<string, Note>();
            prevNotes.forEach((n) => map.set(n.id, n));
            cloudNotes.forEach((cn) => {
              const local = map.get(cn.id);
              if (!local || cn.updatedAt >= local.updatedAt) {
                map.set(cn.id, cn);
              }
            });
            return Array.from(map.values());
          });
        }
        setSyncStatus('synced');
      },
      (error) => {
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.GET, `w/${activeWorkspaceId}/notes`);
      }
    );

    return () => unsubscribe();
  }, [currentUser, activeWorkspaceId, workspaceStatus]);

  // Active note object
  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0] || null;

  // Cloud sync debounced save
  const scheduleCloudSync = useCallback(
    (noteToSync: Note) => {
      if (!currentUser) {
        setSyncStatus('offline');
        return;
      }

      setSyncStatus('saving');
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(async () => {
        try {
          const isExistingInCloud = knownCloudDocIds.current.has(noteToSync.id);
          const sanitizedBlocks = noteToSync.blocks.map((b) => {
            const cleanBlock: Record<string, any> = {
              id: b.id,
              type: b.type,
              content: b.content || '',
            };
            if (b.completed !== undefined) cleanBlock.completed = b.completed;
            if (b.language) cleanBlock.language = b.language;
            if (b.caption) cleanBlock.caption = b.caption;
            if (b.fileName) cleanBlock.fileName = b.fileName;
            if (b.fileSize) cleanBlock.fileSize = b.fileSize;
            if (b.fileType) cleanBlock.fileType = b.fileType;
            if (b.fileUrl) cleanBlock.fileUrl = b.fileUrl;
            if (b.icon) cleanBlock.icon = b.icon;
            return cleanBlock;
          });

          const docRef = doc(db, 'notes', noteToSync.id);

          if (!isExistingInCloud) {
            // Document creation
            const createPayload: Record<string, any> = {
              userId: currentUser.uid,
              workspaceId: activeWorkspaceId,
              title: noteToSync.title || 'Senza titolo',
              isFavorite: !!noteToSync.isFavorite,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              blocks: sanitizedBlocks,
            };
            if (noteToSync.icon) createPayload.icon = noteToSync.icon;
            if (noteToSync.coverUrl) createPayload.coverUrl = noteToSync.coverUrl;

            await setDoc(docRef, createPayload);
            knownCloudDocIds.current.add(noteToSync.id);
          } else {
            // Document update (workspaceId and createdAt remain immutable)
            const updatePayload: Record<string, any> = {
              title: noteToSync.title || 'Senza titolo',
              isFavorite: !!noteToSync.isFavorite,
              updatedAt: serverTimestamp(),
              blocks: sanitizedBlocks,
            };
            if (noteToSync.icon) updatePayload.icon = noteToSync.icon;
            if (noteToSync.coverUrl) updatePayload.coverUrl = noteToSync.coverUrl;

            await setDoc(docRef, updatePayload, { merge: true });
          }

          setSyncStatus('synced');
        } catch (err) {
          console.error('Failed to sync note to Firestore:', err);
          setSyncStatus('error');
        }
      }, 700);
    },
    [currentUser, activeWorkspaceId]
  );

  // Update active note fields
  const handleUpdateNote = (fields: Partial<Note>) => {
    if (!activeNote) return;
    const updatedNote: Note = {
      ...activeNote,
      ...fields,
      updatedAt: Date.now(),
    };

    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
    );
    scheduleCloudSync(updatedNote);

    if (fields.title !== undefined) {
      syncBrowserUrl(activeWorkspaceId, updatedNote.id, fields.title, true);
    }
  };

  // Block updates
  const handleUpdateBlock = (updatedBlock: NoteBlock) => {
    if (!activeNote) return;
    const newBlocks = activeNote.blocks.map((b) =>
      b.id === updatedBlock.id ? updatedBlock : b
    );
    handleUpdateNote({ blocks: newBlocks });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!activeNote) return;
    const newBlocks = activeNote.blocks.filter((b) => b.id !== blockId);
    handleUpdateNote({
      blocks:
        newBlocks.length === 0
          ? [{ id: 'b-' + Date.now(), type: 'paragraph', content: '' }]
          : newBlocks,
    });
  };

  const handleInsertBlockBelow = (type: BlockType, afterIndex: number) => {
    if (!activeNote) return;
    const newBlock: NoteBlock = {
      id: 'b-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type,
      content: '',
      completed: type === 'todo' ? false : undefined,
    };
    const newBlocks = [...activeNote.blocks];
    newBlocks.splice(afterIndex + 1, 0, newBlock);
    handleUpdateNote({ blocks: newBlocks });
  };

  const handleMoveBlockUp = (index: number) => {
    if (!activeNote || index === 0) return;
    const newBlocks = [...activeNote.blocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(index - 1, 0, moved);
    handleUpdateNote({ blocks: newBlocks });
  };

  const handleMoveBlockDown = (index: number) => {
    if (!activeNote || index === activeNote.blocks.length - 1) return;
    const newBlocks = [...activeNote.blocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(index + 1, 0, moved);
    handleUpdateNote({ blocks: newBlocks });
  };

  const handleDuplicateBlock = (index: number) => {
    if (!activeNote) return;
    const original = activeNote.blocks[index];
    const duplicated: NoteBlock = {
      ...original,
      id: 'b-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    };
    const newBlocks = [...activeNote.blocks];
    newBlocks.splice(index + 1, 0, duplicated);
    handleUpdateNote({ blocks: newBlocks });
  };

  const handleReorderBlocks = (
    sourceIndex: number,
    targetIndex: number,
    position: 'top' | 'bottom'
  ) => {
    if (!activeNote || sourceIndex === targetIndex) return;

    const newBlocks = [...activeNote.blocks];
    const [draggedBlock] = newBlocks.splice(sourceIndex, 1);

    let insertIndex = targetIndex;
    if (sourceIndex < targetIndex) {
      insertIndex = position === 'top' ? targetIndex - 1 : targetIndex;
    } else {
      insertIndex = position === 'top' ? targetIndex : targetIndex + 1;
    }

    insertIndex = Math.max(0, Math.min(insertIndex, newBlocks.length));
    newBlocks.splice(insertIndex, 0, draggedBlock);

    handleUpdateNote({ blocks: newBlocks });
  };

  // Select note in active workspace
  const handleSelectNote = (noteId: string) => {
    if (workspaceCacheRef.current[activeWorkspaceId]) {
      workspaceCacheRef.current[activeWorkspaceId].cursorState = { ...lastCursorRef.current };
      workspaceCacheRef.current[activeWorkspaceId].activeNoteId = noteId;
    }
    localStorage.setItem(`liteblocks_last_note_${activeWorkspaceId}`, noteId);

    setActiveNoteId(noteId);
    const target = notes.find((n) => n.id === noteId);
    syncBrowserUrl(activeWorkspaceId, noteId, target?.title, false);
  };

  // Create new note in active workspace with permanent algorithmic UUID (invoked via Ctrl+N)
  const handleCreateNote = () => {
    const newId = generateUuid();
    const newNote: Note = {
      id: newId,
      workspaceId: activeWorkspaceId,
      title: 'Nuova nota',
      icon: '📝',
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blocks: [
        {
          id: 'b-' + Date.now(),
          type: 'paragraph',
          content: '',
        },
      ],
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    syncBrowserUrl(activeWorkspaceId, newNote.id, newNote.title, false);
    scheduleCloudSync(newNote);
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    const remaining = notes.filter((n) => n.id !== noteId);
    setNotes(remaining);
    if (activeNoteId === noteId) {
      const nextNote = remaining[0] || null;
      setActiveNoteId(nextNote?.id || null);
      syncBrowserUrl(activeWorkspaceId, nextNote?.id || null, nextNote?.title, true);
    }

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'notes', noteId));
      } catch (err) {
        console.error('Failed to delete doc in Firestore:', err);
      }
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    if (!target) return;
    const updated = { ...target, isFavorite: !target.isFavorite };
    setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
    scheduleCloudSync(updated);
  };

  // ================= Workspace Management Actions =================

  // Open in place on the SAME tab: preserves workspace in memory, remembers active page & cursor
  const handleSelectWorkspaceInPlace = (nextWsId: string, targetNoteId?: string) => {
    // Only return early if already in that workspace, with status active, and no specific target note requested
    if (nextWsId === activeWorkspaceId && !targetNoteId && workspaceStatus === 'active') return;

    // 1. Snapshot current workspace state and cursor BEFORE leaving (if active)
    if (workspaceStatus === 'active') {
      savePartitionNotes(activeWorkspaceId, notes);
      workspaceCacheRef.current[activeWorkspaceId] = {
        notes,
        activeNoteId,
        status: 'active',
        cursorState: { ...lastCursorRef.current },
      };
      if (activeNoteId) {
        localStorage.setItem(`liteblocks_last_note_${activeWorkspaceId}`, activeNoteId);
      }
    }

    // 2. Retrieve target workspace from RAM cache or load partition into RAM (DO NOT unload)
    let targetWsState = workspaceCacheRef.current[nextWsId];
    if (!targetWsState || targetWsState.status === 'unloaded' || targetWsState.notes.length === 0) {
      const loaded = loadPartitionNotes(nextWsId);
      const savedLastNoteId = localStorage.getItem(`liteblocks_last_note_${nextWsId}`);
      const initialActiveNote =
        (targetNoteId && loaded.find((n) => n.id === targetNoteId)) ||
        (savedLastNoteId && loaded.find((n) => n.id === savedLastNoteId)) ||
        loaded[0] ||
        null;

      targetWsState = {
        notes: loaded,
        activeNoteId: initialActiveNote?.id || null,
        status: 'active',
        cursorState: null,
      };
      workspaceCacheRef.current[nextWsId] = targetWsState;
    }

    const nextNotes = targetWsState.notes;
    // Determine active note: explicit target, or remembered active note in that workspace, or first note
    let nextActiveNoteId: string | null = targetNoteId || null;
    if (!nextActiveNoteId) {
      nextActiveNoteId =
        targetWsState.activeNoteId && nextNotes.some((n) => n.id === targetWsState.activeNoteId)
          ? targetWsState.activeNoteId
          : nextNotes[0]?.id || null;
    }

    // Target cursor restoration state (if switching back to the remembered note)
    const shouldRestoreCursor = !targetNoteId || targetNoteId === targetWsState.activeNoteId;
    restoreTargetRef.current = shouldRestoreCursor ? targetWsState.cursorState || null : null;

    // 3. Activate target workspace
    setActiveWorkspaceId(nextWsId);
    localStorage.setItem(ACTIVE_WS_KEY, nextWsId);
    setWorkspaceStatus('active');
    setWorkspaceStatusMap((prev) => ({
      ...prev,
      [nextWsId]: 'active',
    }));
    setNotes(nextNotes);
    setActiveNoteId(nextActiveNoteId);

    // 4. Update URL with permanent path route and semantic fragment
    const nextNote = nextNotes.find((n) => n.id === nextActiveNoteId);
    syncBrowserUrl(nextWsId, nextActiveNoteId, nextNote?.title, false);
  };

  // Explicitly unload workspace: frees RAM and disconnects listeners (manual user trigger)
  // Can unload either the active workspace or any background workspace held in RAM
  const handleUnloadWorkspace = (targetWsId?: string) => {
    const wsToUnload = targetWsId || activeWorkspaceId;

    if (wsToUnload === activeWorkspaceId) {
      if (workspaceStatus === 'active') {
        savePartitionNotes(activeWorkspaceId, notes);
      }
      if (workspaceCacheRef.current[activeWorkspaceId]) {
        workspaceCacheRef.current[activeWorkspaceId].status = 'unloaded';
        workspaceCacheRef.current[activeWorkspaceId].notes = [];
        workspaceCacheRef.current[activeWorkspaceId].cursorState = null;
      }
      setNotes([]);
      setActiveNoteId(null);
      setWorkspaceStatus('unloaded');
      setWorkspaceStatusMap((prev) => ({
        ...prev,
        [activeWorkspaceId]: 'unloaded',
      }));
      syncBrowserUrl(activeWorkspaceId, null, undefined, true);
    } else {
      // Unloading a background workspace from memory cache
      if (workspaceCacheRef.current[wsToUnload]) {
        if (workspaceCacheRef.current[wsToUnload].notes.length > 0) {
          savePartitionNotes(wsToUnload, workspaceCacheRef.current[wsToUnload].notes);
        }
        workspaceCacheRef.current[wsToUnload].status = 'unloaded';
        workspaceCacheRef.current[wsToUnload].notes = [];
        workspaceCacheRef.current[wsToUnload].cursorState = null;
      }
      setWorkspaceStatusMap((prev) => ({
        ...prev,
        [wsToUnload]: 'unloaded',
      }));
    }
  };

  // Create new workspace
  const handleCreateWorkspace = (name: string, icon: string) => {
    const newWs: WorkspaceMeta = {
      id: 'ws-' + Date.now(),
      name,
      icon,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const starterNoteId = generateUuid();
    // Starter note in the new workspace
    const starterNote: Note = {
      id: starterNoteId,
      workspaceId: newWs.id,
      title: `Benvenuto in ${name} 🌟`,
      icon: icon || '🌟',
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blocks: [
        {
          id: 'b-init-1',
          type: 'heading1',
          content: `Spazio di lavoro: ${name}`,
        },
        {
          id: 'b-init-2',
          type: 'paragraph',
          content: 'Questo workspace opera come un sito virtuale isolato in un block based editor. Inizia a scrivere note multimediali.',
        },
      ],
    };

    savePartitionNotes(newWs.id, [starterNote]);

    const updatedWorkspaces = [...workspaces, newWs];
    setWorkspaces(updatedWorkspaces);
    saveWorkspacesManifest(updatedWorkspaces);
    setWorkspaceStatusMap((prev) => ({
      ...prev,
      [newWs.id]: 'active',
    }));

    // Switch to the newly created workspace in place
    handleSelectWorkspaceInPlace(newWs.id);
  };

  // Update workspace meta
  const handleUpdateWorkspace = (wsId: string, name: string, icon: string) => {
    const updated = workspaces.map((w) =>
      w.id === wsId ? { ...w, name, icon, updatedAt: Date.now() } : w
    );
    setWorkspaces(updated);
    saveWorkspacesManifest(updated);
  };

  // Delete workspace
  const handleDeleteWorkspace = (wsId: string) => {
    if (workspaces.length <= 1) return;

    deleteWorkspacePartition(wsId);
    delete workspaceCacheRef.current[wsId];
    localStorage.removeItem(`liteblocks_last_note_${wsId}`);

    const remaining = workspaces.filter((w) => w.id !== wsId);
    setWorkspaces(remaining);
    saveWorkspacesManifest(remaining);
    setWorkspaceStatusMap((prev) => {
      const copy = { ...prev };
      delete copy[wsId];
      return copy;
    });

    if (activeWorkspaceId === wsId) {
      handleSelectWorkspaceInPlace(remaining[0].id);
    }
  };

  // Cross-workspace navigation handler: always opens target workspace page in a separate tab
  const handleNavigateCrossWorkspace = (targetWsNameOrId: string, targetNoteTitle?: string) => {
    const link = resolveCrossWorkspaceLink(targetWsNameOrId, targetNoteTitle);
    if (link) {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Select result from global search
  const handleSelectGlobalSearchResult = (wsId: string, noteId: string) => {
    if (wsId !== activeWorkspaceId) {
      handleSelectWorkspaceInPlace(wsId, noteId);
    } else {
      handleSelectNote(noteId);
    }
  };

  // Global Keyboard shortcuts:
  // - Ctrl/Cmd + Shift + K: Global multi-workspace search
  // - Ctrl/Cmd + K: Standard search focus in sidebar
  // - Ctrl/Cmd + N: Create new note
  // - Ctrl/Cmd + \: Toggle sidebar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setGlobalSearchQuery('');
        setIsGlobalSearchOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'k') {
        e.preventDefault();
        if (!isSidebarOpen) {
          setIsSidebarOpen(true);
        }
        sidebarRef.current?.focusSearch();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (workspaceStatus === 'active') {
          handleCreateNote();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [notes, workspaceStatus, isSidebarOpen]);

  const activeWsMeta = workspaces.find((w) => w.id === activeWorkspaceId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#191919] text-neutral-900 dark:text-neutral-100 selection:bg-neutral-200 dark:selection:bg-neutral-700">
      {/* Sidebar Navigation */}
      <Sidebar
        ref={sidebarRef}
        notes={notes}
        activeNoteId={activeNoteId}
        onSelectNote={handleSelectNote}
        onDeleteNote={handleDeleteNote}
        onToggleFavorite={handleToggleFavorite}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isOpen={isSidebarOpen}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        currentUser={currentUser}
        onLogin={loginWithGoogle}
        onLogout={logoutUser}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        workspaceStatus={workspaceStatus}
        workspaceStatusMap={workspaceStatusMap}
        loadedWorkspaces={workspaceCacheRef.current}
        onSelectWorkspaceInPlace={handleSelectWorkspaceInPlace}
        onCreateWorkspace={handleCreateWorkspace}
        onUpdateWorkspace={handleUpdateWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
        onUnloadWorkspace={handleUnloadWorkspace}
        onOpenGlobalSearch={(q) => {
          setGlobalSearchQuery(q || '');
          setIsGlobalSearchOpen(true);
        }}
        onOpenMemoryDiagnostics={() => setIsMemoryModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto flex flex-col relative">
        {workspaceStatus === 'unloaded' ? (
          // Unloaded Workspace Standby Screen (Zero Memory Footprint)
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-400">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4 text-neutral-500 shadow-xs">
              <Power className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Workspace "{activeWsMeta?.name || 'Workspace'}" a riposo
            </h3>
            <p className="text-xs max-w-md text-neutral-500 dark:text-neutral-400 mb-5 leading-relaxed">
              Questo workspace è stato scaricato dalla memoria RAM per garantire il massimo isolamento e liberare risorse. I documenti restano al sicuro nel loro storage dedicato.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSelectWorkspaceInPlace(activeWorkspaceId)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 rounded-lg shadow-sm hover:opacity-90 transition-opacity"
              >
                <Database className="w-4 h-4" />
                <span>Carica workspace in memoria</span>
              </button>
            </div>
          </div>
        ) : activeNote ? (
          <div className="flex-1 pb-32">
            <EditorHeader
              note={activeNote}
              syncStatus={syncStatus}
              isLoggedIn={!!currentUser}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              isSidebarOpen={isSidebarOpen}
            />

            {/* Blocks canvas container */}
            <div className="max-w-3xl mx-auto px-12 pt-6 space-y-1">
              {activeNote.blocks.map((block, idx) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  index={idx}
                  totalBlocks={activeNote.blocks.length}
                  onUpdate={handleUpdateBlock}
                  onDelete={handleDeleteBlock}
                  onInsertBelow={handleInsertBlockBelow}
                  onMoveUp={handleMoveBlockUp}
                  onMoveDown={handleMoveBlockDown}
                  onDuplicate={handleDuplicateBlock}
                  onOpenLightbox={(src, caption) =>
                    setLightboxData({ src, caption })
                  }
                  onReorderBlocks={handleReorderBlocks}
                  onNavigateCrossWorkspace={handleNavigateCrossWorkspace}
                />
              ))}

              {/* Click or drop to add / append block at bottom */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceIndexStr = e.dataTransfer.getData('text/plain');
                  const sourceIndex = parseInt(sourceIndexStr, 10);
                  if (!isNaN(sourceIndex) && activeNote.blocks.length > 0) {
                    handleReorderBlocks(sourceIndex, activeNote.blocks.length - 1, 'bottom');
                  }
                }}
                onClick={() =>
                  handleInsertBlockBelow('paragraph', activeNote.blocks.length - 1)
                }
                className="h-28 cursor-text border-2 border-transparent hover:border-dashed hover:border-neutral-200 dark:hover:border-neutral-800 rounded-xl transition-colors mt-2"
                title="Clicca per aggiungere testo in fondo o rilascia per spostare alla fine"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-400">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4 text-neutral-500">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-display text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              Nessuna nota in questo workspace
            </h3>
            <p className="text-xs max-w-sm mb-4">
              Crea una nuova nota premendo <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-mono text-[11px]">Ctrl+N</kbd> per iniziare a organizzare testi, to-do list, codice, foto e allegati.
            </p>
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 rounded-lg shadow-sm hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Crea la prima nota (Ctrl+N)
            </button>
          </div>
        )}
      </main>

      {/* Global Search Modal (Ctrl/Cmd + Shift + K or Alt+Enter from search) */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        initialQuery={globalSearchQuery}
        workspaces={workspaces}
        onClose={() => setIsGlobalSearchOpen(false)}
        onSelectResult={handleSelectGlobalSearchResult}
      />

      {/* Fullscreen Lightbox Modal */}
      {lightboxData && (
        <LightboxModal
          src={lightboxData.src}
          caption={lightboxData.caption}
          onClose={() => setLightboxData(null)}
        />
      )}

      {/* Memory & Performance Diagnostics Modal */}
      <MemoryDiagnosticsModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        activeWorkspace={activeWsMeta || workspaces[0]}
        workspaceStatus={workspaceStatus}
        notes={notes}
        workspaces={workspaces}
        loadedWorkspaces={workspaceCacheRef.current}
        onUnloadWorkspace={handleUnloadWorkspace}
        onReloadWorkspace={() => handleSelectWorkspaceInPlace(activeWorkspaceId)}
      />
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note, NoteBlock, BlockType, SyncStatus, WorkspaceMeta, WorkspaceStatus } from './types/note';
import { Sidebar, SidebarHandle } from './components/Sidebar';
import { EditorHeader } from './components/EditorHeader';
import { EditorFooter } from './components/EditorFooter';
import { BlockRenderer } from './components/BlockRenderer';
import { SelectionOverlay } from './components/SelectionOverlay';
import { LightboxModal } from './components/LightboxModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { MemoryDiagnosticsModal } from './components/MemoryDiagnosticsModal';
import {
  MultiBlockSelection,
  computeMultiBlockSelectionRects,
  extractMultiBlockText,
  deleteMultiBlockSelection,
  getCharOffsetFromDomPoint,
  getDomPointFromCharOffset,
} from './lib/crossBlockSelection';
import { writeMultiMimeToClipboard } from './lib/clipboard';
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
  getThemeById,
  getThemeCssVariables,
  DEFAULT_THEME_ID,
} from './lib/themes';
import {
  getContentWidthCss,
  FALLBACK_DEFAULT_WIDTH,
  ConcreteContentWidth,
} from './lib/contentWidth';
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

export interface FocusTarget {
  id: string;
  cursorPosition?: 'start' | 'end' | number;
  targetClientX?: number;
  targetLine?: 'first' | 'last';
}

const ACTIVE_WS_KEY = 'liteblocks_active_ws_id_v1';
const THEME_KEY = 'liteblocks_theme_v1';

export default function App() {
  const sidebarRef = useRef<SidebarHandle>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const [focusedBlockTarget, setFocusedBlockTarget] = useState<FocusTarget | null>(null);
  const [multiBlockSelection, setMultiBlockSelection] = useState<MultiBlockSelection | null>(null);
  const multiBlockSelectionRef = useRef<MultiBlockSelection | null>(null);
  multiBlockSelectionRef.current = multiBlockSelection;
  const [selectionRects, setSelectionRects] = useState<DOMRect[]>([]);
  const isDraggingRef = useRef(false);
  const dragStartPointRef = useRef<{
    blockId: string;
    blockIndex: number;
    offset: number;
    clientX: number;
    clientY: number;
  } | null>(null);

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

  const activeWsMeta = workspaces.find((w) => w.id === activeWorkspaceId);
  const currentTheme = getThemeById(activeWsMeta?.themeId || (isDarkMode ? 'tokyo-night' : DEFAULT_THEME_ID));
  const activeWsDefaultContentWidth = activeWsMeta?.defaultContentWidth || FALLBACK_DEFAULT_WIDTH;
  const lastLightThemeRef = useRef<string>(currentTheme.mode === 'light' ? currentTheme.id : 'bright-minimal');
  const lastDarkThemeRef = useRef<string>(currentTheme.mode === 'dark' ? currentTheme.id : 'tokyo-night');

  const handleSetWorkspaceDefaultContentWidth = (width: ConcreteContentWidth) => {
    setWorkspaces((prev) => {
      const updated = prev.map((w) =>
        w.id === activeWorkspaceId
          ? { ...w, defaultContentWidth: width, updatedAt: Date.now() }
          : w
      );
      saveWorkspacesManifest(updated);
      return updated;
    });
  };

  // Apply active theme variables and dark mode class to html element
  useEffect(() => {
    if (currentTheme.mode === 'dark') {
      lastDarkThemeRef.current = currentTheme.id;
    } else {
      lastLightThemeRef.current = currentTheme.id;
    }

    const isDark = currentTheme.mode === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
      localStorage.setItem(THEME_KEY, 'light');
    }

    const root = document.documentElement;
    const cssVars = getThemeCssVariables(currentTheme);
    Object.entries(cssVars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
  }, [currentTheme]);

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
            contentWidth: data.contentWidth || undefined,
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
            if (noteToSync.contentWidth) createPayload.contentWidth = noteToSync.contentWidth;

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
            if (noteToSync.contentWidth) updatePayload.contentWidth = noteToSync.contentWidth;

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
    const index = activeNote.blocks.findIndex((b) => b.id === blockId);
    const newBlocks = activeNote.blocks.filter((b) => b.id !== blockId);

    const finalBlocks =
      newBlocks.length === 0
        ? [{ id: 'b-' + Date.now(), type: 'paragraph' as BlockType, content: '' }]
        : newBlocks;

    const targetIndex = newBlocks.length === 0 ? 0 : Math.max(0, index - 1);
    setFocusedBlockTarget({ id: finalBlocks[targetIndex].id, cursorPosition: 'end' });

    handleUpdateNote({ blocks: finalBlocks });
  };

  const handleInsertBlockBelow = (
    type: BlockType,
    afterIndex: number,
    currentBlockContent?: string,
    newBlockContent: string = '',
    blockData?: Partial<NoteBlock>
  ) => {
    if (!activeNote) return;
    const newBlockId = 'b-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const { id: _ignoredId, ...restBlockData } = blockData || {};
    const newBlock: NoteBlock = {
      type,
      content: newBlockContent,
      completed: type === 'todo' ? false : undefined,
      ...restBlockData,
      id: newBlockId,
    };
    const newBlocks = [...activeNote.blocks];
    if (currentBlockContent !== undefined && newBlocks[afterIndex]) {
      newBlocks[afterIndex] = {
        ...newBlocks[afterIndex],
        content: currentBlockContent,
      };
    }
    newBlocks.splice(afterIndex + 1, 0, newBlock);
    setFocusedBlockTarget({ id: newBlockId, cursorPosition: 'start' });
    handleUpdateNote({ blocks: newBlocks });
  };

  const handleMergeWithPrevious = (currentIndex: number) => {
    if (!activeNote || currentIndex <= 0) return;
    const prevBlock = activeNote.blocks[currentIndex - 1];
    const currentBlock = activeNote.blocks[currentIndex];
    if (!prevBlock || !currentBlock) return;

    const isTextBlock = (b: NoteBlock) => b.type !== 'image' && b.type !== 'file';

    if (!isTextBlock(prevBlock) || !isTextBlock(currentBlock)) {
      if (currentBlock.content === '') {
        handleDeleteBlock(currentBlock.id);
      }
      return;
    }

    const cursorPosition = (prevBlock.content || '').length;
    const mergedContent = (prevBlock.content || '') + (currentBlock.content || '');

    const newBlocks = [...activeNote.blocks];
    newBlocks[currentIndex - 1] = {
      ...prevBlock,
      content: mergedContent,
    };
    newBlocks.splice(currentIndex, 1);

    setFocusedBlockTarget({
      id: prevBlock.id,
      cursorPosition,
    });

    handleUpdateNote({ blocks: newBlocks });
  };

  const handleMergeWithNext = (currentIndex: number) => {
    if (!activeNote || currentIndex >= activeNote.blocks.length - 1) return;
    const currentBlock = activeNote.blocks[currentIndex];
    const nextBlock = activeNote.blocks[currentIndex + 1];
    if (!currentBlock || !nextBlock) return;

    const isTextBlock = (b: NoteBlock) => b.type !== 'image' && b.type !== 'file';

    if (!isTextBlock(currentBlock) || !isTextBlock(nextBlock)) {
      if (nextBlock.content === '') {
        handleDeleteBlock(nextBlock.id);
      }
      return;
    }

    const cursorPosition = (currentBlock.content || '').length;
    const mergedContent = (currentBlock.content || '') + (nextBlock.content || '');

    const newBlocks = [...activeNote.blocks];
    newBlocks[currentIndex] = {
      ...currentBlock,
      content: mergedContent,
    };
    newBlocks.splice(currentIndex + 1, 1);

    setFocusedBlockTarget({
      id: currentBlock.id,
      cursorPosition,
    });

    handleUpdateNote({ blocks: newBlocks });
  };

  const handleNavigateCursor = (
    direction: 'up' | 'down',
    fromIndex: number | 'title',
    currentClientX: number
  ) => {
    if (!activeNote) return;

    if (direction === 'up') {
      if (fromIndex === 'title') {
        return;
      }
      if (fromIndex === 0) {
        setFocusedBlockTarget({
          id: 'note-title',
          targetLine: 'last',
          targetClientX: currentClientX,
        });
        return;
      }
      let prevIdx = fromIndex - 1;
      while (prevIdx >= 0 && (activeNote.blocks[prevIdx].type === 'image' || activeNote.blocks[prevIdx].type === 'file')) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        setFocusedBlockTarget({
          id: activeNote.blocks[prevIdx].id,
          targetLine: 'last',
          targetClientX: currentClientX,
        });
      } else {
        setFocusedBlockTarget({
          id: 'note-title',
          targetLine: 'last',
          targetClientX: currentClientX,
        });
      }
    } else {
      if (fromIndex === 'title') {
        let firstIdx = 0;
        while (firstIdx < activeNote.blocks.length && (activeNote.blocks[firstIdx].type === 'image' || activeNote.blocks[firstIdx].type === 'file')) {
          firstIdx++;
        }
        if (firstIdx < activeNote.blocks.length) {
          setFocusedBlockTarget({
            id: activeNote.blocks[firstIdx].id,
            targetLine: 'first',
            targetClientX: currentClientX,
          });
        }
        return;
      }
      let nextIdx = fromIndex + 1;
      while (nextIdx < activeNote.blocks.length && (activeNote.blocks[nextIdx].type === 'image' || activeNote.blocks[nextIdx].type === 'file')) {
        nextIdx++;
      }
      if (nextIdx < activeNote.blocks.length) {
        setFocusedBlockTarget({
          id: activeNote.blocks[nextIdx].id,
          targetLine: 'first',
          targetClientX: currentClientX,
        });
      }
    }
  };

  const handleShiftBoundary = (
    direction: 'up' | 'down' | 'left' | 'right',
    fromIndex: number,
    anchorOffset: number,
    _focusOffset: number,
    _clientX?: number
  ) => {
    if (!activeNote) return;

    if (direction === 'up' && fromIndex > 0) {
      const targetIndex = fromIndex - 1;
      const targetBlock = activeNote.blocks[targetIndex];
      const targetOffset = targetBlock.content?.length || 0;

      const newSelection: MultiBlockSelection = {
        anchor: {
          blockId: activeNote.blocks[fromIndex].id,
          blockIndex: fromIndex,
          offset: anchorOffset,
        },
        focus: {
          blockId: targetBlock.id,
          blockIndex: targetIndex,
          offset: targetOffset,
        },
      };
      window.getSelection()?.removeAllRanges();
      setMultiBlockSelection(newSelection);
      if (canvasScrollRef.current) {
        setSelectionRects(
          computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, newSelection)
        );
      }
    } else if (direction === 'down' && fromIndex < activeNote.blocks.length - 1) {
      const targetIndex = fromIndex + 1;
      const targetBlock = activeNote.blocks[targetIndex];
      const targetOffset = 0;

      const newSelection: MultiBlockSelection = {
        anchor: {
          blockId: activeNote.blocks[fromIndex].id,
          blockIndex: fromIndex,
          offset: anchorOffset,
        },
        focus: {
          blockId: targetBlock.id,
          blockIndex: targetIndex,
          offset: targetOffset,
        },
      };
      window.getSelection()?.removeAllRanges();
      setMultiBlockSelection(newSelection);
      if (canvasScrollRef.current) {
        setSelectionRects(
          computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, newSelection)
        );
      }
    } else if (direction === 'left' && fromIndex > 0) {
      const targetIndex = fromIndex - 1;
      const targetBlock = activeNote.blocks[targetIndex];
      const newSelection: MultiBlockSelection = {
        anchor: {
          blockId: activeNote.blocks[fromIndex].id,
          blockIndex: fromIndex,
          offset: anchorOffset,
        },
        focus: {
          blockId: targetBlock.id,
          blockIndex: targetIndex,
          offset: targetBlock.content?.length || 0,
        },
      };
      window.getSelection()?.removeAllRanges();
      setMultiBlockSelection(newSelection);
      if (canvasScrollRef.current) {
        setSelectionRects(
          computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, newSelection)
        );
      }
    } else if (direction === 'right' && fromIndex < activeNote.blocks.length - 1) {
      const targetIndex = fromIndex + 1;
      const targetBlock = activeNote.blocks[targetIndex];
      const newSelection: MultiBlockSelection = {
        anchor: {
          blockId: activeNote.blocks[fromIndex].id,
          blockIndex: fromIndex,
          offset: anchorOffset,
        },
        focus: {
          blockId: targetBlock.id,
          blockIndex: targetIndex,
          offset: 0,
        },
      };
      window.getSelection()?.removeAllRanges();
      setMultiBlockSelection(newSelection);
      if (canvasScrollRef.current) {
        setSelectionRects(
          computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, newSelection)
        );
      }
    }
  };

  const handleSelectAllPage = useCallback(() => {
    if (!activeNote || activeNote.blocks.length === 0) return;
    const firstBlock = activeNote.blocks[0];
    const lastBlock = activeNote.blocks[activeNote.blocks.length - 1];
    const newSelection: MultiBlockSelection = {
      anchor: {
        blockId: firstBlock.id,
        blockIndex: 0,
        offset: 0,
      },
      focus: {
        blockId: lastBlock.id,
        blockIndex: activeNote.blocks.length - 1,
        offset: lastBlock.content?.length || 0,
      },
    };
    window.getSelection()?.removeAllRanges();
    (document.activeElement as HTMLElement)?.blur?.();
    multiBlockSelectionRef.current = newSelection;
    setMultiBlockSelection(newSelection);
    if (canvasScrollRef.current) {
      setSelectionRects(
        computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, newSelection)
      );
    }
  }, [activeNote]);

  // Canvas Mouse Down: Detect start of potential drag selection
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    // Ignore interactive UI elements like buttons, inputs, links, dropdowns
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, a, [role="button"], .group\\/submenu')) {
      return;
    }

    const blockEl = target.closest<HTMLElement>('[data-block-id]');
    if (!blockEl || !activeNote) {
      if (multiBlockSelection) {
        multiBlockSelectionRef.current = null;
        setMultiBlockSelection(null);
        setSelectionRects([]);
      }
      return;
    }

    const blockId = blockEl.getAttribute('data-block-id');
    const blockIndex = activeNote.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return;

    let charOffset = 0;
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos && blockEl.contains(pos.offsetNode)) {
        charOffset = getCharOffsetFromDomPoint(blockEl, pos.offsetNode, pos.offset);
      }
    } else if ((document as any).caretRangeFromPoint) {
      const r = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
      if (r && blockEl.contains(r.startContainer)) {
        charOffset = getCharOffsetFromDomPoint(blockEl, r.startContainer, r.startOffset);
      }
    }

    isDraggingRef.current = true;
    dragStartPointRef.current = {
      blockId: blockId!,
      blockIndex,
      offset: charOffset,
      clientX: e.clientX,
      clientY: e.clientY,
    };

    if (multiBlockSelection) {
      multiBlockSelectionRef.current = null;
      setMultiBlockSelection(null);
      setSelectionRects([]);
    }
  };

  // Mouse drag across blocks tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartPointRef.current || !activeNote) return;

      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      let blockEl = target?.closest<HTMLElement>('[data-block-id]');
      let isAboveBlock = false;
      let isBelowBlock = false;

      // If mouse is in margins or between blocks, find closest block vertically
      if (!blockEl && canvasScrollRef.current) {
        const blockEls = Array.from(
          canvasScrollRef.current.querySelectorAll<HTMLElement>('[data-block-id]')
        );
        if (blockEls.length > 0) {
          let minDistance = Infinity;
          let closestEl = blockEls[0];

          for (const el of blockEls) {
            const rect = el.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
              closestEl = el;
              minDistance = 0;
              break;
            }
            const dist = e.clientY < rect.top ? rect.top - e.clientY : e.clientY - rect.bottom;
            if (dist < minDistance) {
              minDistance = dist;
              closestEl = el;
            }
          }
          blockEl = closestEl;
          const rect = blockEl.getBoundingClientRect();
          if (e.clientY < rect.top) isAboveBlock = true;
          if (e.clientY > rect.bottom) isBelowBlock = true;
        }
      } else if (blockEl) {
        const rect = blockEl.getBoundingClientRect();
        if (e.clientY < rect.top) isAboveBlock = true;
        if (e.clientY > rect.bottom) isBelowBlock = true;
      }

      if (!blockEl) return;
      const blockId = blockEl.getAttribute('data-block-id');
      const blockIndex = activeNote.blocks.findIndex((b) => b.id === blockId);
      if (blockIndex === -1) return;

      const currentBlock = activeNote.blocks[blockIndex];
      const contentLength = currentBlock.content?.length || 0;

      let charOffset = 0;
      if (isBelowBlock) {
        charOffset = contentLength;
      } else if (isAboveBlock) {
        charOffset = 0;
      } else {
        const blockRect = blockEl.getBoundingClientRect();
        const clampedY = Math.min(Math.max(e.clientY, blockRect.top + 2), blockRect.bottom - 2);

        if (document.caretPositionFromPoint) {
          const pos = document.caretPositionFromPoint(e.clientX, clampedY);
          if (pos && blockEl.contains(pos.offsetNode)) {
            charOffset = getCharOffsetFromDomPoint(blockEl, pos.offsetNode, pos.offset);
          } else {
            charOffset = e.clientX > blockRect.right ? contentLength : 0;
          }
        } else if ((document as any).caretRangeFromPoint) {
          const r = (document as any).caretRangeFromPoint(e.clientX, clampedY);
          if (r && blockEl.contains(r.startContainer)) {
            charOffset = getCharOffsetFromDomPoint(blockEl, r.startContainer, r.startOffset);
          } else {
            charOffset = e.clientX > blockRect.right ? contentLength : 0;
          }
        }
      }

      const anchor = dragStartPointRef.current;
      if (blockIndex !== anchor.blockIndex || multiBlockSelectionRef.current !== null) {
        window.getSelection()?.removeAllRanges();

        const newSelection: MultiBlockSelection = {
          anchor: {
            blockId: anchor.blockId,
            blockIndex: anchor.blockIndex,
            offset: anchor.offset,
          },
          focus: {
            blockId: blockId!,
            blockIndex,
            offset: charOffset,
          },
        };
        multiBlockSelectionRef.current = newSelection;
        setMultiBlockSelection(newSelection);
        if (canvasScrollRef.current) {
          setSelectionRects(
            computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, newSelection)
          );
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      dragStartPointRef.current = null;
      const currentMultiSel = multiBlockSelectionRef.current;
      if (currentMultiSel) {
        if (currentMultiSel.anchor.blockIndex === currentMultiSel.focus.blockIndex) {
          const block = activeNote?.blocks[currentMultiSel.anchor.blockIndex];
          if (block && canvasScrollRef.current) {
            const editorEl = canvasScrollRef.current.querySelector<HTMLElement>(`[data-block-id="${block.id}"]`);
            if (editorEl) {
              const anchorPt = getDomPointFromCharOffset(editorEl, currentMultiSel.anchor.offset);
              const focusPt = getDomPointFromCharOffset(editorEl, currentMultiSel.focus.offset);
              editorEl.focus({ preventScroll: true });
              const sel = window.getSelection();
              if (sel) {
                try {
                  sel.setBaseAndExtent(anchorPt.node, anchorPt.offset, focusPt.node, focusPt.offset);
                } catch {
                  const isForward = currentMultiSel.anchor.offset <= currentMultiSel.focus.offset;
                  const startPt = isForward ? anchorPt : focusPt;
                  const endPt = isForward ? focusPt : anchorPt;
                  try {
                    const range = document.createRange();
                    range.setStart(startPt.node, startPt.offset);
                    range.setEnd(endPt.node, endPt.offset);
                    sel.removeAllRanges();
                    sel.addRange(range);
                  } catch {
                    // Fallback ignore
                  }
                }
              }
            }
          }
          multiBlockSelectionRef.current = null;
          setMultiBlockSelection(null);
          setSelectionRects([]);
        } else {
          window.getSelection()?.removeAllRanges();
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeNote, multiBlockSelection]);

  // Recalculate selection rects on window resize or scroll
  useEffect(() => {
    if (!multiBlockSelection || !activeNote || !canvasScrollRef.current) return;
    const updateRects = () => {
      if (canvasScrollRef.current && multiBlockSelection && activeNote) {
        setSelectionRects(
          computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, multiBlockSelection)
        );
      }
    };
    window.addEventListener('resize', updateRects);
    const scrollEl = canvasScrollRef.current;
    scrollEl.addEventListener('scroll', updateRects);
    return () => {
      window.removeEventListener('resize', updateRects);
      scrollEl.removeEventListener('scroll', updateRects);
    };
  }, [multiBlockSelection, activeNote]);

  // Keyboard operations for active multi-block selection (Copy, Cut, Delete, Typing, Shift+Arrows)
  useEffect(() => {
    if (!multiBlockSelection || !activeNote) return;

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      // 0. Select All Page (Ctrl+A / Cmd+A) when multi-block selection is already active
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        handleSelectAllPage();
        return;
      }

      // 1. Copy (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        const { plain } = extractMultiBlockText(activeNote.blocks, multiBlockSelection);
        writeMultiMimeToClipboard(plain);
        return;
      }

      // 2. Cut (Ctrl+X / Cmd+X) or WM_CUT (Shift+Delete)
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) ||
        (e.shiftKey && (e.key === 'Delete' || e.key === 'Del') && !e.ctrlKey && !e.metaKey && !e.altKey)
      ) {
        e.preventDefault();
        e.stopPropagation();
        const { plain } = extractMultiBlockText(activeNote.blocks, multiBlockSelection);
        writeMultiMimeToClipboard(plain);
        const { newBlocks, targetBlockId, targetOffset } = deleteMultiBlockSelection(
          activeNote.blocks,
          multiBlockSelection,
          ''
        );
        handleUpdateNote({ blocks: newBlocks });
        setFocusedBlockTarget({ id: targetBlockId, cursorPosition: targetOffset });
        setMultiBlockSelection(null);
        setSelectionRects([]);
        return;
      }

      // 3. Delete / Backspace
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Del') {
        e.preventDefault();
        e.stopPropagation();
        const { newBlocks, targetBlockId, targetOffset } = deleteMultiBlockSelection(
          activeNote.blocks,
          multiBlockSelection,
          ''
        );
        handleUpdateNote({ blocks: newBlocks });
        setFocusedBlockTarget({ id: targetBlockId, cursorPosition: targetOffset });
        setMultiBlockSelection(null);
        setSelectionRects([]);
        return;
      }

      // 4. Escape: dismiss selection
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMultiBlockSelection(null);
        setSelectionRects([]);
        return;
      }

      // 5. Shift+Arrows navigation / expansion
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          if (multiBlockSelection.focus.blockIndex > 0) {
            const nextIdx = multiBlockSelection.focus.blockIndex - 1;
            const targetBlock = activeNote.blocks[nextIdx];
            const targetLen = targetBlock.content?.length || 0;
            const newFocusOffset = Math.min(multiBlockSelection.focus.offset, targetLen);
            const updated: MultiBlockSelection = {
              ...multiBlockSelection,
              focus: {
                blockId: targetBlock.id,
                blockIndex: nextIdx,
                offset: newFocusOffset,
              },
            };
            setMultiBlockSelection(updated);
            if (canvasScrollRef.current) {
              setSelectionRects(
                computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, updated)
              );
            }
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          if (multiBlockSelection.focus.blockIndex < activeNote.blocks.length - 1) {
            const nextIdx = multiBlockSelection.focus.blockIndex + 1;
            const targetBlock = activeNote.blocks[nextIdx];
            const targetLen = targetBlock.content?.length || 0;
            const newFocusOffset = Math.min(multiBlockSelection.focus.offset, targetLen);
            const updated: MultiBlockSelection = {
              ...multiBlockSelection,
              focus: {
                blockId: targetBlock.id,
                blockIndex: nextIdx,
                offset: newFocusOffset,
              },
            };
            setMultiBlockSelection(updated);
            if (canvasScrollRef.current) {
              setSelectionRects(
                computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, updated)
              );
            }
          }
          return;
        }

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          let nextIdx = multiBlockSelection.focus.blockIndex;
          let nextOffset = multiBlockSelection.focus.offset - 1;
          if (nextOffset < 0 && nextIdx > 0) {
            nextIdx -= 1;
            nextOffset = activeNote.blocks[nextIdx].content?.length || 0;
          }
          if (nextOffset >= 0) {
            const updated: MultiBlockSelection = {
              ...multiBlockSelection,
              focus: {
                blockId: activeNote.blocks[nextIdx].id,
                blockIndex: nextIdx,
                offset: nextOffset,
              },
            };
            setMultiBlockSelection(updated);
            if (canvasScrollRef.current) {
              setSelectionRects(
                computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, updated)
              );
            }
          }
          return;
        }

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          let nextIdx = multiBlockSelection.focus.blockIndex;
          let nextOffset = multiBlockSelection.focus.offset + 1;
          const currentLen = activeNote.blocks[nextIdx].content?.length || 0;
          if (nextOffset > currentLen && nextIdx < activeNote.blocks.length - 1) {
            nextIdx += 1;
            nextOffset = 0;
          }
          if (nextIdx < activeNote.blocks.length) {
            const updated: MultiBlockSelection = {
              ...multiBlockSelection,
              focus: {
                blockId: activeNote.blocks[nextIdx].id,
                blockIndex: nextIdx,
                offset: Math.min(nextOffset, activeNote.blocks[nextIdx].content?.length || 0),
              },
            };
            setMultiBlockSelection(updated);
            if (canvasScrollRef.current) {
              setSelectionRects(
                computeMultiBlockSelectionRects(canvasScrollRef.current, activeNote.blocks, updated)
              );
            }
          }
          return;
        }
      }

      // 6. Typing single printable character replaces selection
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        const { newBlocks, targetBlockId, targetOffset } = deleteMultiBlockSelection(
          activeNote.blocks,
          multiBlockSelection,
          e.key
        );
        handleUpdateNote({ blocks: newBlocks });
        setFocusedBlockTarget({ id: targetBlockId, cursorPosition: targetOffset });
        setMultiBlockSelection(null);
        setSelectionRects([]);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDownCapture, true);
    return () => window.removeEventListener('keydown', handleKeyDownCapture, true);
  }, [multiBlockSelection, activeNote, handleSelectAllPage]);

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
      contentWidth: 'default',
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
  const handleCreateWorkspace = (name: string, icon: string, themeId?: string) => {
    const newWs: WorkspaceMeta = {
      id: 'ws-' + Date.now(),
      name,
      icon,
      themeId: themeId || DEFAULT_THEME_ID,
      defaultContentWidth: FALLBACK_DEFAULT_WIDTH,
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
      contentWidth: 'default',
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
  const handleUpdateWorkspace = (wsId: string, name: string, icon: string, themeId?: string) => {
    const updated = workspaces.map((w) =>
      w.id === wsId
        ? {
            ...w,
            name,
            icon,
            themeId: themeId || w.themeId || DEFAULT_THEME_ID,
            updatedAt: Date.now(),
          }
        : w
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

  const handleApplyTheme = (themeId: string) => {
    handleUpdateWorkspace(
      activeWorkspaceId,
      activeWsMeta?.name || 'Workspace',
      activeWsMeta?.icon || '📁',
      themeId
    );
  };

  const handleToggleDarkMode = () => {
    const targetThemeId =
      currentTheme.mode === 'dark'
        ? lastLightThemeRef.current || 'bright-minimal'
        : lastDarkThemeRef.current || 'tokyo-night';
    handleApplyTheme(targetThemeId);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--theme-bg-app)',
        color: 'var(--theme-text-main)',
      }}
      className="flex h-screen w-screen overflow-hidden"
    >
      {/* Sidebar Navigation */}
      <Sidebar
        ref={sidebarRef}
        notes={notes}
        activeNoteId={activeNoteId}
        onSelectNote={handleSelectNote}
        onDeleteNote={handleDeleteNote}
        onToggleFavorite={handleToggleFavorite}
        isDarkMode={currentTheme.mode === 'dark'}
        onToggleDarkMode={handleToggleDarkMode}
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
        onApplyTheme={handleApplyTheme}
        onDeleteWorkspace={handleDeleteWorkspace}
        onUnloadWorkspace={handleUnloadWorkspace}
        onOpenGlobalSearch={(q) => {
          setGlobalSearchQuery(q || '');
          setIsGlobalSearchOpen(true);
        }}
        onOpenMemoryDiagnostics={() => setIsMemoryModalOpen(true)}
      />

      {/* Main Content Area */}
      <main
        style={{
          backgroundColor: 'var(--theme-bg-app)',
          color: 'var(--theme-text-main)',
        }}
        className="flex-1 h-full overflow-hidden flex flex-col relative"
      >
        <div
          ref={canvasScrollRef}
          onMouseDown={handleCanvasMouseDown}
          className="flex-1 overflow-y-auto flex flex-col relative"
        >
          <SelectionOverlay rects={selectionRects} />
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
                defaultContentWidth={activeWsDefaultContentWidth}
                focusedBlockTarget={focusedBlockTarget}
                onFocusHandled={() => setFocusedBlockTarget(null)}
                onNavigateCursor={handleNavigateCursor}
                onSelectAllPage={handleSelectAllPage}
                onUpdateNote={handleUpdateNote}
              />

              {/* Blocks canvas container */}
              <div
                style={{ maxWidth: getContentWidthCss(activeNote.contentWidth, activeWsDefaultContentWidth) }}
                className="w-full mx-auto px-12 pt-6 space-y-1 transition-[max-width] duration-150"
                onTransitionEnd={(e) => {
                  if (e.propertyName === 'max-width') {
                    window.dispatchEvent(new Event('resize'));
                  }
                }}
              >
                {activeNote.blocks.map((block, idx) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    index={idx}
                    totalBlocks={activeNote.blocks.length}
                    autoFocus={focusedBlockTarget?.id === block.id}
                    focusPosition={
                      focusedBlockTarget?.id === block.id
                        ? focusedBlockTarget.cursorPosition
                        : undefined
                    }
                    focusTarget={
                      focusedBlockTarget?.id === block.id
                        ? focusedBlockTarget
                        : null
                    }
                    onFocusHandled={() => setFocusedBlockTarget(null)}
                    onNavigateCursor={handleNavigateCursor}
                    onShiftBoundary={handleShiftBoundary}
                    onSelectAllPage={handleSelectAllPage}
                    onUpdate={handleUpdateBlock}
                    onDelete={handleDeleteBlock}
                    onInsertBelow={handleInsertBlockBelow}
                    onMergeWithPrevious={handleMergeWithPrevious}
                    onMergeWithNext={handleMergeWithNext}
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
        </div>

        {/* Editor Footer pinned at bottom */}
        <EditorFooter
          note={activeNote}
          syncStatus={syncStatus}
          isLoggedIn={!!currentUser}
          isSidebarOpen={isSidebarOpen}
          defaultContentWidth={activeWsDefaultContentWidth}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onSetDefaultContentWidth={handleSetWorkspaceDefaultContentWidth}
        />
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

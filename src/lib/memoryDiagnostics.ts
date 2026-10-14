import { Note, WorkspaceMeta, WorkspaceStatus } from '../types/note';

export interface WorkspaceMemoryFootprint {
  totalBytes: number;
  formattedBytes: string;
  notesCount: number;
  blocksCount: number;
  blocksByType: {
    text: number;
    headings: number;
    todo: number;
    code: number;
    image: number;
    file: number;
    other: number;
  };
  mediaBytesEstimate: number;
  textBytesEstimate: number;
}

export interface BrowserMemoryStats {
  supported: boolean;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
  formattedUsed?: string;
  formattedTotal?: string;
  formattedLimit?: string;
  usagePercent?: number;
  domNodesCount: number;
}

export interface WorkspacePartitionSize {
  workspaceId: string;
  name: string;
  icon: string;
  status: WorkspaceStatus;
  storageBytes: number;
  formattedStorage: string;
  ramBytes: number;
  formattedRam: string;
}

export interface FullTabMemoryFootprint {
  // Quanta memoria si recupera se si chiude il tab corrente (stimata a livello OS/Processo)
  totalRecoverableBytes: number;
  formattedTotalRecoverable: string;

  // Dettaglio componenti:
  // 1. JavaScript Heap
  jsHeapUsedBytes: number;
  formattedJsHeapUsed: string;
  jsHeapTotalBytes: number;
  formattedJsHeapTotal: string;
  jsHeapLimitBytes: number;
  formattedJsHeapLimit: string;
  isJsHeapNative: boolean;

  // 2. Rendering grafico & Bitmap decodificate a video (GPU / Compositor buffers)
  decodedBitmapsBytes: number;
  formattedDecodedBitmaps: string;
  renderedImagesCount: number;

  // 3. Albero DOM e cache stili C++ Blink
  domNodesCount: number;
  domEstimatedBytes: number;
  formattedDomEstimated: string;

  // 4. Baseline del processo di tab Chromium (Blink engine, V8 isolate, IPC channels)
  processBaselineBytes: number;
  formattedProcessBaseline: string;

  // 5. Dati puri dell'applicazione in RAM
  workspaceDataBytes: number;
  formattedWorkspaceData: string;

  // 6. Cache locale offline (LocalStorage per partizioni)
  storageCacheBytes: number;
  formattedStorageCache: string;
}

/**
 * Format bytes into human-readable representation
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

/**
 * Accurately calculate the memory footprint of active notes loaded in RAM
 */
export function getWorkspaceMemoryFootprint(notes: Note[]): WorkspaceMemoryFootprint {
  if (!notes || notes.length === 0) {
    return {
      totalBytes: 0,
      formattedBytes: '0 B',
      notesCount: 0,
      blocksCount: 0,
      blocksByType: {
        text: 0,
        headings: 0,
        todo: 0,
        code: 0,
        image: 0,
        file: 0,
        other: 0,
      },
      mediaBytesEstimate: 0,
      textBytesEstimate: 0,
    };
  }

  let totalJsonBytes = 0;
  try {
    const serialized = JSON.stringify(notes);
    totalJsonBytes = new Blob([serialized]).size;
  } catch {
    totalJsonBytes = 0;
  }

  let totalBlocks = 0;
  let textBytes = 0;
  let mediaBytes = 0;

  const blocksByType = {
    text: 0,
    headings: 0,
    todo: 0,
    code: 0,
    image: 0,
    file: 0,
    other: 0,
  };

  for (const note of notes) {
    textBytes += new Blob([note.title || '']).size;
    for (const b of note.blocks) {
      totalBlocks++;
      const contentBytes = new Blob([b.content || '']).size;

      switch (b.type) {
        case 'paragraph':
        case 'quote':
        case 'callout':
          blocksByType.text++;
          textBytes += contentBytes;
          break;
        case 'heading1':
        case 'heading2':
        case 'heading3':
          blocksByType.headings++;
          textBytes += contentBytes;
          break;
        case 'todo':
          blocksByType.todo++;
          textBytes += contentBytes;
          break;
        case 'code':
          blocksByType.code++;
          textBytes += contentBytes;
          break;
        case 'image':
          blocksByType.image++;
          mediaBytes += contentBytes;
          if (b.fileUrl) mediaBytes += new Blob([b.fileUrl]).size;
          break;
        case 'file':
          blocksByType.file++;
          mediaBytes += contentBytes;
          if (b.fileUrl) mediaBytes += new Blob([b.fileUrl]).size;
          break;
        default:
          blocksByType.other++;
          textBytes += contentBytes;
      }
    }
  }

  return {
    totalBytes: totalJsonBytes,
    formattedBytes: formatBytes(totalJsonBytes),
    notesCount: notes.length,
    blocksCount: totalBlocks,
    blocksByType,
    mediaBytesEstimate: mediaBytes,
    textBytesEstimate: textBytes,
  };
}

/**
 * Retrieve browser JavaScript Heap metrics via Chromium performance.memory API
 */
export function getBrowserMemoryStats(): BrowserMemoryStats {
  const domNodes = typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0;
  const perf = typeof window !== 'undefined' ? (window.performance as any) : null;
  const memory = perf?.memory;

  if (memory && typeof memory.usedJSHeapSize === 'number') {
    const used = memory.usedJSHeapSize;
    const total = memory.totalJSHeapSize;
    const limit = memory.jsHeapSizeLimit;
    const usagePercent = limit > 0 ? Math.round((used / limit) * 100) : 0;

    return {
      supported: true,
      usedJSHeapSize: used,
      totalJSHeapSize: total,
      jsHeapSizeLimit: limit,
      formattedUsed: formatBytes(used),
      formattedTotal: formatBytes(total),
      formattedLimit: formatBytes(limit),
      usagePercent,
      domNodesCount: domNodes,
    };
  }

  return {
    supported: false,
    domNodesCount: domNodes,
  };
}

/**
 * Measure memory occupied by uncompressed raster bitmaps rendered in DOM (GPU / Compositor buffers)
 */
export function calculateDecodedBitmapsMemory(): { bytes: number; count: number } {
  if (typeof document === 'undefined') return { bytes: 0, count: 0 };
  let totalBytes = 0;
  let count = 0;

  const images = document.getElementsByTagName('img');
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const w = img.naturalWidth || img.clientWidth || 0;
    const h = img.naturalHeight || img.clientHeight || 0;
    if (w > 0 && h > 0) {
      // 4 bytes per pixel (RGBA 32-bit raster buffer in Blink compositor / GPU memory)
      totalBytes += w * h * 4;
      count++;
    }
  }

  const canvases = document.getElementsByTagName('canvas');
  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const w = canvas.width || 0;
    const h = canvas.height || 0;
    if (w > 0 && h > 0) {
      totalBytes += w * h * 4;
      count++;
    }
  }

  return { bytes: totalBytes, count };
}

/**
 * Calculate total memory footprint of the current tab (everything that is reclaimed if tab is closed)
 */
export function getFullTabMemoryFootprint(
  notes: Note[],
  workspaceStatus: WorkspaceStatus
): FullTabMemoryFootprint {
  const wsData =
    workspaceStatus === 'active'
      ? getWorkspaceMemoryFootprint(notes)
      : { totalBytes: 0, formattedBytes: '0 B' };

  const browserStats = getBrowserMemoryStats();
  const bitmaps = calculateDecodedBitmapsMemory();
  const domNodes = browserStats.domNodesCount;

  // Blink C++ DOM nodes & ComputedStyle cache (~1.8 KB per node)
  const domEstimatedBytes = domNodes * 1800;

  // Base overhead of a Chromium tab renderer process (Blink layout, V8 isolate base, IPC channel buffers)
  const processBaselineBytes = 44 * 1024 * 1024; // ~44 MB

  let jsHeapUsed = 0;
  let jsHeapTotal = 0;
  let jsHeapLimit = 0;
  let isNative = false;

  if (browserStats.supported && browserStats.usedJSHeapSize && browserStats.totalJSHeapSize) {
    jsHeapUsed = browserStats.usedJSHeapSize;
    jsHeapTotal = browserStats.totalJSHeapSize;
    jsHeapLimit = browserStats.jsHeapSizeLimit || 0;
    isNative = true;
  } else {
    // Realistic fallback for Safari/Firefox where performance.memory is restricted
    jsHeapUsed = 28 * 1024 * 1024 + wsData.totalBytes;
    jsHeapTotal = 36 * 1024 * 1024 + wsData.totalBytes;
    jsHeapLimit = 2048 * 1024 * 1024;
    isNative = false;
  }

  // LocalStorage total offline cache
  let storageCacheBytes = 0;
  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key) || '';
          storageCacheBytes += (key.length + val.length) * 2; // UTF-16 in JS string
        }
      }
    } catch {
      storageCacheBytes = 0;
    }
  }

  // Quanta memoria recupera l'utente se chiude il tab corrente:
  // L'intero processo della scheda (heap totale allocato + buffer bitmap GPU/compositor + nodi DOM C++ + infrastruttura del processo)
  const totalRecoverableBytes =
    jsHeapTotal + bitmaps.bytes + domEstimatedBytes + processBaselineBytes;

  return {
    totalRecoverableBytes,
    formattedTotalRecoverable: formatBytes(totalRecoverableBytes),
    jsHeapUsedBytes: jsHeapUsed,
    formattedJsHeapUsed: formatBytes(jsHeapUsed),
    jsHeapTotalBytes: jsHeapTotal,
    formattedJsHeapTotal: formatBytes(jsHeapTotal),
    jsHeapLimitBytes: jsHeapLimit,
    formattedJsHeapLimit: formatBytes(jsHeapLimit),
    isJsHeapNative: isNative,
    decodedBitmapsBytes: bitmaps.bytes,
    formattedDecodedBitmaps: formatBytes(bitmaps.bytes),
    renderedImagesCount: bitmaps.count,
    domNodesCount: domNodes,
    domEstimatedBytes,
    formattedDomEstimated: formatBytes(domEstimatedBytes),
    processBaselineBytes,
    formattedProcessBaseline: formatBytes(processBaselineBytes),
    workspaceDataBytes: wsData.totalBytes,
    formattedWorkspaceData: wsData.formattedBytes,
    storageCacheBytes,
    formattedStorageCache: formatBytes(storageCacheBytes),
  };
}

/**
 * Measure partition storage footprint across all workspaces
 */
export function getPartitionsMemoryOverview(
  workspaces: WorkspaceMeta[],
  activeWorkspaceId: string,
  workspaceStatus: WorkspaceStatus,
  activeNotes: Note[],
  loadedWorkspaces?: Record<string, { notes: Note[]; status: WorkspaceStatus }>
): WorkspacePartitionSize[] {
  const NOTE_STORAGE_PREFIX = 'liteblocks_ws_';

  return workspaces.map((ws) => {
    const isCurrent = ws.id === activeWorkspaceId;
    const key = `${NOTE_STORAGE_PREFIX}${ws.id}_notes`;
    const rawStorage = localStorage.getItem(key) || '';
    const storageBytes = new Blob([rawStorage]).size;

    const cachedWs = loadedWorkspaces ? loadedWorkspaces[ws.id] : undefined;
    const isActiveInRam = cachedWs
      ? cachedWs.status === 'active' && cachedWs.notes.length > 0
      : isCurrent && workspaceStatus === 'active';

    const wsNotes = cachedWs ? cachedWs.notes : (isCurrent ? activeNotes : []);
    const ramBytes = isActiveInRam ? new Blob([JSON.stringify(wsNotes)]).size : 0;

    return {
      workspaceId: ws.id,
      name: ws.name,
      icon: ws.icon,
      status: isActiveInRam ? 'active' : 'unloaded',
      storageBytes,
      formattedStorage: formatBytes(storageBytes),
      ramBytes,
      formattedRam: formatBytes(ramBytes),
    };
  });
}

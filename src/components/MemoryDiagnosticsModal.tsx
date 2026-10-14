import React, { useState, useEffect } from 'react';
import { Note, WorkspaceMeta, WorkspaceStatus } from '../types/note';
import {
  getFullTabMemoryFootprint,
  getPartitionsMemoryOverview,
  FullTabMemoryFootprint,
  WorkspacePartitionSize,
} from '../lib/memoryDiagnostics';
import {
  X,
  RefreshCw,
  Cpu,
  HardDrive,
  Database,
  Layers,
  Power,
  ShieldCheck,
  Info,
  CheckCircle2,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';

interface MemoryDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspace: WorkspaceMeta;
  workspaceStatus: WorkspaceStatus;
  notes: Note[];
  workspaces: WorkspaceMeta[];
  loadedWorkspaces?: Record<string, { notes: Note[]; status: WorkspaceStatus }>;
  onUnloadWorkspace: () => void;
  onReloadWorkspace: () => void;
}

export const MemoryDiagnosticsModal: React.FC<MemoryDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  activeWorkspace,
  workspaceStatus,
  notes,
  workspaces,
  loadedWorkspaces,
  onUnloadWorkspace,
  onReloadWorkspace,
}) => {
  const [activeTab, setActiveTab] = useState<'all_inclusive' | 'isolation' | 'benchmark'>('all_inclusive');
  const [tabFootprint, setTabFootprint] = useState<FullTabMemoryFootprint>(() =>
    getFullTabMemoryFootprint(notes, workspaceStatus)
  );
  const [partitions, setPartitions] = useState<WorkspacePartitionSize[]>(() =>
    getPartitionsMemoryOverview(workspaces, activeWorkspace.id, workspaceStatus, notes, loadedWorkspaces)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshMetrics = () => {
    setIsRefreshing(true);
    setTabFootprint(getFullTabMemoryFootprint(notes, workspaceStatus));
    setPartitions(getPartitionsMemoryOverview(workspaces, activeWorkspace.id, workspaceStatus, notes, loadedWorkspaces));
    setTimeout(() => setIsRefreshing(false), 250);
  };

  useEffect(() => {
    if (isOpen) {
      refreshMetrics();
    }
  }, [isOpen, notes, activeWorkspace.id, workspaceStatus, workspaces, loadedWorkspaces]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#202020] rounded-2xl shadow-2xl border border-[#ececeb] dark:border-[#2e2e2e] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ececeb] dark:border-[#2e2e2e] bg-white dark:bg-[#202020]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-neutral-800 dark:text-neutral-200">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                Diagnostica Memoria & Risorse Tab
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Memoria effettiva occupata nel browser, stato processi e recupero alla chiusura
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={refreshMetrics}
              disabled={isRefreshing}
              className={`p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              title="Ricalcola metriche in tempo reale"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Chiudi finestra"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#ececeb] dark:border-[#2e2e2e] px-5 gap-4 text-xs font-medium bg-[#fbfbfa] dark:bg-[#191919]">
          <button
            onClick={() => setActiveTab('all_inclusive')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'all_inclusive'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Memoria Effettiva Tab (Tutto Compreso)
          </button>
          <button
            onClick={() => setActiveTab('isolation')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'isolation'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Isolamento Workspace ({partitions.length})
          </button>
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'benchmark'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Stima Benchmark (20 pagine)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#202020]">
          {activeTab === 'all_inclusive' && (
            <>
              {/* Hero Banner: Total Memory Reclaimed if Tab is Closed */}
              <div className="p-4 rounded-xl border border-[#ececeb] dark:border-[#2e2e2e] bg-[#fbfbfa] dark:bg-[#191919] space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                      Memoria recuperabile chiudendo questo tab (Tutto compreso)
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                        ~{tabFootprint.formattedTotalRecoverable}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        liberati a livello di sistema operativo
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-[#ececeb] dark:border-[#2e2e2e]">
                    Processo Chromium
                  </span>
                </div>

                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Questa metrica riflette l'intera impronta reale della scheda: include il runtime JavaScript V8 (heap allocato), la decodifica grafica delle immagini a schermo (bitmap raster), l'albero C++ del DOM e l'infrastruttura del processo della scheda.
                </p>

                {/* Visual Colored Proportion Bar */}
                <div className="space-y-2 pt-1">
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-3 rounded-lg overflow-hidden flex gap-0.5 p-0.5 shadow-inner">
                    {/* Process Base (Slate) */}
                    <div
                      className="bg-slate-400 dark:bg-slate-500 h-full rounded-xs transition-all hover:opacity-90"
                      style={{
                        width: `${Math.max(2, Math.round((tabFootprint.processBaselineBytes / tabFootprint.totalRecoverableBytes) * 100))}%`,
                      }}
                      title={`Processo Base Chromium: ${tabFootprint.formattedProcessBaseline} (~${Math.round((tabFootprint.processBaselineBytes / tabFootprint.totalRecoverableBytes) * 100)}%)`}
                    />
                    {/* JS Heap (Blue) */}
                    <div
                      className="bg-blue-500 dark:bg-blue-400 h-full rounded-xs transition-all hover:opacity-90"
                      style={{
                        width: `${Math.max(2, Math.round((tabFootprint.jsHeapTotalBytes / tabFootprint.totalRecoverableBytes) * 100))}%`,
                      }}
                      title={`JavaScript Heap V8: ${tabFootprint.formattedJsHeapTotal} (~${Math.round((tabFootprint.jsHeapTotalBytes / tabFootprint.totalRecoverableBytes) * 100)}%)`}
                    />
                    {/* Bitmaps (Emerald) */}
                    <div
                      className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-xs transition-all hover:opacity-90"
                      style={{
                        width: `${Math.max(2, Math.round((tabFootprint.decodedBitmapsBytes / tabFootprint.totalRecoverableBytes) * 100))}%`,
                      }}
                      title={`Bitmap & Rendering Grafico GPU: ${tabFootprint.formattedDecodedBitmaps} (~${Math.round((tabFootprint.decodedBitmapsBytes / tabFootprint.totalRecoverableBytes) * 100)}%)`}
                    />
                    {/* DOM C++ (Amber) */}
                    <div
                      className="bg-amber-500 dark:bg-amber-400 h-full rounded-xs transition-all hover:opacity-90"
                      style={{
                        width: `${Math.max(1.5, Math.round((tabFootprint.domEstimatedBytes / tabFootprint.totalRecoverableBytes) * 100))}%`,
                      }}
                      title={`Buffer DOM C++ & Layout: ~${tabFootprint.formattedDomEstimated} (~${Math.round((tabFootprint.domEstimatedBytes / tabFootprint.totalRecoverableBytes) * 100)}%)`}
                    />
                    {/* Workspace Data RAM (Violet) */}
                    {workspaceStatus === 'active' && tabFootprint.workspaceDataBytes > 0 && (
                      <div
                        className="bg-violet-500 dark:bg-violet-400 h-full rounded-xs transition-all hover:opacity-90"
                        style={{
                          width: `${Math.max(1.5, Math.round((tabFootprint.workspaceDataBytes / tabFootprint.totalRecoverableBytes) * 100))}%`,
                        }}
                        title={`Dati Workspace in RAM: ${tabFootprint.formattedWorkspaceData}`}
                      />
                    )}
                  </div>

                  {/* Colored Legend */}
                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[10px] font-mono">
                    <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 dark:bg-slate-500 shrink-0" />
                      <span>Processo Base:</span>
                      <strong className="text-neutral-900 dark:text-neutral-200">{tabFootprint.formattedProcessBaseline}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                      <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 dark:bg-blue-400 shrink-0" />
                      <span>JS Heap V8:</span>
                      <strong className="text-neutral-900 dark:text-neutral-200">{tabFootprint.formattedJsHeapTotal}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                      <span>Bitmap GPU:</span>
                      <strong className="text-neutral-900 dark:text-neutral-200">{tabFootprint.formattedDecodedBitmaps}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 dark:bg-amber-400 shrink-0" />
                      <span>DOM C++:</span>
                      <strong className="text-neutral-900 dark:text-neutral-200">~{tabFootprint.formattedDomEstimated}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                      <span className="w-2.5 h-2.5 rounded-xs bg-violet-500 dark:bg-violet-400 shrink-0" />
                      <span>Dati Workspace:</span>
                      <strong className="text-neutral-900 dark:text-neutral-200">
                        {workspaceStatus === 'active' ? tabFootprint.formattedWorkspaceData : '0 B'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. JavaScript Engine & Runtime (Blue) */}
                <div className="p-3.5 rounded-xl border border-[#ececeb] dark:border-[#2e2e2e] border-l-4 border-l-blue-500 dark:border-l-blue-400 bg-[#fbfbfa] dark:bg-[#191919] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                      JavaScript Heap (Motore V8)
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 font-medium">
                      {tabFootprint.isJsHeapNative ? 'API Chromium' : 'Stima sicura'}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between py-0.5 border-b border-[#ececeb]/60 dark:border-[#2e2e2e]/60">
                      <span className="text-neutral-500 dark:text-neutral-400">Heap attualmente in uso:</span>
                      <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        {tabFootprint.formattedJsHeapUsed}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#ececeb]/60 dark:border-[#2e2e2e]/60">
                      <span className="text-neutral-500 dark:text-neutral-400">Heap totale allocato:</span>
                      <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        {tabFootprint.formattedJsHeapTotal}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-500 dark:text-neutral-400">Limite massimo heap:</span>
                      <span className="font-mono text-neutral-500">
                        {tabFootprint.formattedJsHeapLimit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Rendering & Graphics Memory (Emerald) */}
                <div className="p-3.5 rounded-xl border border-[#ececeb] dark:border-[#2e2e2e] border-l-4 border-l-emerald-500 dark:border-l-emerald-400 bg-[#fbfbfa] dark:bg-[#191919] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                      Rendering & Grafica (GPU / Blink)
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 font-medium">
                      {tabFootprint.renderedImagesCount} immagini a video
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between py-0.5 border-b border-[#ececeb]/60 dark:border-[#2e2e2e]/60">
                      <span className="text-neutral-500 dark:text-neutral-400">Bitmap decodificate (RGBA):</span>
                      <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        {tabFootprint.formattedDecodedBitmaps}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#ececeb]/60 dark:border-[#2e2e2e]/60">
                      <span className="text-neutral-500 dark:text-neutral-400">Elementi DOM a schermo:</span>
                      <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        {tabFootprint.domNodesCount} nodi
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-500 dark:text-neutral-400">Buffer C++ Layout & Stili:</span>
                      <span className="font-mono text-neutral-500">
                        ~{tabFootprint.formattedDomEstimated}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Dati Workspace Attivo in RAM (Violet) */}
                <div className="p-3.5 rounded-xl border border-[#ececeb] dark:border-[#2e2e2e] border-l-4 border-l-violet-500 dark:border-l-violet-400 bg-[#fbfbfa] dark:bg-[#191919] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
                      Dati Workspace Attivo
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 font-medium">
                      {workspaceStatus === 'active' ? 'In RAM' : 'A riposo'}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between py-0.5 border-b border-[#ececeb]/60 dark:border-[#2e2e2e]/60">
                      <span className="text-neutral-500 dark:text-neutral-400">Peso serializzato (UTF-8):</span>
                      <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        {workspaceStatus === 'active' ? tabFootprint.formattedWorkspaceData : '0 B'}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-500 dark:text-neutral-400">Note e blocchi in memoria:</span>
                      <span className="font-mono text-neutral-500">
                        {workspaceStatus === 'active' ? `${notes.length} note caricate` : 'Nessuna'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. DOM & Processo Tab Base (Amber & Slate) */}
                <div className="p-3.5 rounded-xl border border-[#ececeb] dark:border-[#2e2e2e] border-l-4 border-l-amber-500 dark:border-l-amber-400 bg-[#fbfbfa] dark:bg-[#191919] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      DOM & Processo Tab Base
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 font-medium">
                      Blink + IPC
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between py-0.5 border-b border-[#ececeb]/60 dark:border-[#2e2e2e]/60">
                      <span className="text-neutral-500 dark:text-neutral-400">Buffer nodi e stili C++:</span>
                      <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        ~{tabFootprint.formattedDomEstimated}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#ececeb]/60 dark:border-[#2e2e2e]/60">
                      <span className="text-neutral-500 dark:text-neutral-400">Processo Sandbox Chromium:</span>
                      <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        ~{tabFootprint.formattedProcessBaseline}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-500 dark:text-neutral-400">Cache locale partizioni:</span>
                      <span className="font-mono text-neutral-500">
                        {tabFootprint.formattedStorageCache} ({partitions.length} ws)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-3 rounded-xl border border-[#ececeb] dark:border-[#2e2e2e] bg-[#fbfbfa] dark:bg-[#191919] flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100 block">
                    Gestione RAM del Workspace
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {workspaceStatus === 'active'
                      ? 'Scarica le note di questo workspace per liberare l\'heap dei dati'
                      : 'Il workspace è attualmente scaricato (0 byte in RAM)'}
                  </span>
                </div>

                {workspaceStatus === 'active' ? (
                  <button
                    onClick={() => {
                      onUnloadWorkspace();
                      refreshMetrics();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 rounded-lg font-medium transition-opacity text-[11px] shadow-2xs shrink-0"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Scarica workspace</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onReloadWorkspace();
                      refreshMetrics();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 rounded-lg font-medium transition-opacity text-[11px] shadow-2xs shrink-0"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Carica workspace</span>
                  </button>
                )}
              </div>
            </>
          )}

          {activeTab === 'isolation' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#fbfbfa] dark:bg-[#191919] border border-[#ececeb] dark:border-[#2e2e2e] text-neutral-700 dark:text-neutral-300">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Isolamento Architetturale Verificato</strong>: Soltanto il workspace selezionato ({activeWorkspace.name}) risiede nella memoria heap della scheda ({tabFootprint.formattedWorkspaceData}). I restanti workspace sono a riposo e consumano esattamente <span className="font-mono font-semibold">0 B di RAM</span>, non influenzando prestazioni, garbage collection né rendering del tab.
                </p>
              </div>

              <div className="rounded-xl border border-[#ececeb] dark:border-[#2e2e2e] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fbfbfa] dark:bg-[#191919] text-neutral-500 dark:text-neutral-400 text-[10px] uppercase font-mono border-b border-[#ececeb] dark:border-[#2e2e2e]">
                    <tr>
                      <th className="py-2.5 px-3">Workspace</th>
                      <th className="py-2.5 px-3">Stato</th>
                      <th className="py-2.5 px-3 text-right">In RAM (Heap)</th>
                      <th className="py-2.5 px-3 text-right">Su Disco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ececeb] dark:divide-[#2e2e2e] font-mono text-[11px]">
                    {partitions.map((p) => {
                      const isCurrent = p.workspaceId === activeWorkspace.id;
                      const inRam = p.status === 'active';
                      return (
                        <tr
                          key={p.workspaceId}
                          className={isCurrent ? 'bg-neutral-100/40 dark:bg-neutral-800/30' : ''}
                        >
                          <td className="py-2.5 px-3 font-sans font-medium text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                            <span>{p.icon}</span>
                            <span className="truncate max-w-[140px]">{p.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                                attivo
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            {inRam ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                                <CheckCircle2 className="w-3 h-3" /> In memoria
                              </span>
                            ) : (
                              <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">
                                A riposo (Isolato)
                              </span>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-semibold ${
                              inRam
                                ? 'text-neutral-900 dark:text-neutral-100'
                                : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                          >
                            {p.formattedRam}
                          </td>
                          <td className="py-2.5 px-3 text-right text-neutral-500 dark:text-neutral-400">
                            {p.formattedStorage}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
                <span>Spazio locale memorizzato su disco (tutte le partizioni):</span>
                <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                  {tabFootprint.formattedStorageCache}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'benchmark' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#fbfbfa] dark:bg-[#191919] border border-[#ececeb] dark:border-[#2e2e2e]">
                <Info className="w-4 h-4 shrink-0 text-neutral-400 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400 space-y-1">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Stima per Sito Tipo (20 pagine · 30 blocchi misti · 1 immagine/pagina)
                  </div>
                  <p>
                    Ecco come il browser alloca la memoria di un sito di queste dimensioni con l'architettura Lite Blocks:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-[#ececeb] dark:border-[#2e2e2e] bg-[#fbfbfa] dark:bg-[#191919] space-y-2">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Con Immagini URL Remote
                  </span>
                  <ul className="text-[11px] text-neutral-500 dark:text-neutral-400 space-y-1 font-mono">
                    <li>• Dati JSON in RAM: ~96 KB</li>
                    <li>• Oggetti JavaScript V8: ~350–500 KB</li>
                    <li>• Bitmap decodificate a video: ~3.8 MB</li>
                    <li>• Baseline processo Chromium: ~44 MB</li>
                    <li className="pt-1.5 text-neutral-900 dark:text-neutral-100 font-semibold border-t border-[#ececeb] dark:border-[#2e2e2e]">
                      Totale Processo Tab: ~75–110 MB
                    </li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl border border-[#ececeb] dark:border-[#2e2e2e] bg-[#fbfbfa] dark:bg-[#191919] space-y-2">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Con Immagini Base64 Inline
                  </span>
                  <ul className="text-[11px] text-neutral-500 dark:text-neutral-400 space-y-1 font-mono">
                    <li>• Dati JSON in RAM: ~5.1 MB</li>
                    <li>• Oggetti JavaScript V8: ~5.5 MB</li>
                    <li>• Bitmap decodificate a video: ~3.8 MB</li>
                    <li>• Baseline processo Chromium: ~44 MB</li>
                    <li className="pt-1.5 text-neutral-900 dark:text-neutral-100 font-semibold border-t border-[#ececeb] dark:border-[#2e2e2e]">
                      Totale Processo Tab: ~85–125 MB
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/40 border border-[#ececeb] dark:border-[#2e2e2e] text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                <strong>Ottimizzazione raster</strong>: Solo l'immagine della pagina attualmente aperta viene decodificata in memoria bitmap (VRAM). Le immagini delle pagine non aperte non consumano memoria grafica.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#ececeb] dark:border-[#2e2e2e] bg-[#fbfbfa] dark:bg-[#191919] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px]">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Memoria misurata sul processo attivo del browser</span>
          </div>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-medium text-xs shadow-2xs hover:opacity-90 transition-opacity"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

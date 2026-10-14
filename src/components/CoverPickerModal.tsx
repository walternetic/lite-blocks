import React, { useState } from 'react';
import { PRESET_COVERS } from '../lib/sampleData';
import { Image, Link, X } from 'lucide-react';

interface CoverPickerModalProps {
  currentCover?: string;
  onSelect: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export const CoverPickerModal: React.FC<CoverPickerModalProps> = ({
  currentCover,
  onSelect,
  onRemove,
  onClose,
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'presets' | 'url'>('presets');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Copertina della pagina
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex gap-2 px-5 pt-3 border-b border-neutral-100 dark:border-neutral-700">
          <button
            onClick={() => setActiveTab('presets')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'presets'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            Predefiniti Minimal
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'url'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            URL Personalizzato
          </button>
        </div>

        <div className="p-5 max-h-80 overflow-y-auto">
          {activeTab === 'presets' ? (
            <div className="grid grid-cols-2 gap-3">
              {PRESET_COVERS.map((cover) => (
                <button
                  key={cover.url}
                  onClick={() => {
                    onSelect(cover.url);
                    onClose();
                  }}
                  className={`group relative h-24 rounded-lg overflow-hidden border transition-all text-left ${
                    currentCover === cover.url
                      ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-400'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                  }`}
                >
                  <img
                    src={cover.url}
                    alt={cover.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-2">
                    <span className="text-xs text-white font-medium truncate">
                      {cover.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300">
                Incolla il link diretto all'immagine (JPEG, PNG, WebP)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800 dark:text-neutral-100"
                />
                <button
                  onClick={() => {
                    if (customUrl.trim()) {
                      onSelect(customUrl.trim());
                      onClose();
                    }
                  }}
                  disabled={!customUrl.trim()}
                  className="px-4 py-2 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg disabled:opacity-40"
                >
                  Applica
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 bg-neutral-50 dark:bg-neutral-900/60 border-t border-neutral-100 dark:border-neutral-700 text-xs">
          {currentCover ? (
            <button
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="text-rose-600 dark:text-rose-400 hover:underline font-medium"
            >
              Rimuovi copertina
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

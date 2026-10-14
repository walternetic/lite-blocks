import React, { useState } from 'react';
import { COMMON_EMOJIS } from '../lib/sampleData';

interface EmojiPickerProps {
  currentEmoji?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  currentEmoji,
  onSelect,
  onClose,
}) => {
  const [customEmoji, setCustomEmoji] = useState('');

  return (
    <div className="absolute z-50 mt-2 p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl w-64 animate-in fade-in zoom-in-95 duration-100">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-100 dark:border-neutral-700 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
        <span>Scegli icona</span>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-0.5 rounded"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className={`w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors ${
              currentEmoji === emoji
                ? 'bg-neutral-100 dark:bg-neutral-700 ring-2 ring-neutral-400'
                : ''
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-700">
        <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
          O inserisci un'altra emoji:
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customEmoji}
            onChange={(e) => setCustomEmoji(e.target.value)}
            placeholder="es. 🚀 o ✨"
            maxLength={4}
            className="flex-1 px-2 py-1 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800 dark:text-neutral-100"
          />
          <button
            onClick={() => {
              if (customEmoji.trim()) {
                onSelect(customEmoji.trim());
                onClose();
              }
            }}
            disabled={!customEmoji.trim()}
            className="px-2.5 py-1 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-md disabled:opacity-40"
          >
            Usa
          </button>
        </div>
      </div>
    </div>
  );
};

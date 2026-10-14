import React, { useState, useEffect, useRef } from 'react';
import { BlockType } from '../types/note';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  Code,
  Image as ImageIcon,
  Paperclip,
  Quote,
  Lightbulb,
  Link2,
} from 'lucide-react';

export type SlashItemType = BlockType | 'page_link';

interface SlashItem {
  type: SlashItemType;
  title: string;
  description: string;
  icon: React.ReactNode;
  keywords: string[];
}

const SLASH_ITEMS: SlashItem[] = [
  {
    type: 'paragraph',
    title: 'Testo',
    description: 'Inizia a scrivere con testo semplice formattabile',
    icon: <Type className="w-4 h-4 text-neutral-500" />,
    keywords: ['testo', 'paragrafo', 'text', 'p'],
  },
  {
    type: 'heading1',
    title: 'Titolo 1',
    description: 'Intestazione principale di grande dimensione',
    icon: <Heading1 className="w-4 h-4 text-neutral-600" />,
    keywords: ['titolo', 'h1', 'heading', 'grande'],
  },
  {
    type: 'heading2',
    title: 'Titolo 2',
    description: 'Sottotitolo per sezioni intermedie',
    icon: <Heading2 className="w-4 h-4 text-neutral-600" />,
    keywords: ['titolo', 'h2', 'heading', 'medio'],
  },
  {
    type: 'heading3',
    title: 'Titolo 3',
    description: 'Intestazione compatta per sotto-sezioni',
    icon: <Heading3 className="w-4 h-4 text-neutral-600" />,
    keywords: ['titolo', 'h3', 'heading', 'piccolo'],
  },
  {
    type: 'todo',
    title: 'Checklist To-Do',
    description: 'Casella di controllo per tracciare attività',
    icon: <CheckSquare className="w-4 h-4 text-blue-500" />,
    keywords: ['todo', 'checklist', 'task', 'attivita', 'compito'],
  },
  {
    type: 'code',
    title: 'Blocco Codice',
    description: 'Frammento di codice con selettore linguaggio e copia',
    icon: <Code className="w-4 h-4 text-emerald-500" />,
    keywords: ['code', 'codice', 'programma', 'script', 'snippet'],
  },
  {
    type: 'image',
    title: 'Immagine',
    description: 'Carica un\'immagine locale o specifica un link',
    icon: <ImageIcon className="w-4 h-4 text-amber-500" />,
    keywords: ['immagine', 'foto', 'image', 'picture', 'upload'],
  },
  {
    type: 'file',
    title: 'Allegato File',
    description: 'Aggiungi qualsiasi file scaricabile con dimensione',
    icon: <Paperclip className="w-4 h-4 text-purple-500" />,
    keywords: ['file', 'allegato', 'documento', 'pdf', 'zip'],
  },
  {
    type: 'callout',
    title: 'Callout informativo',
    description: 'Metti in risalto consigli, avvisi o note chiave',
    icon: <Lightbulb className="w-4 h-4 text-amber-500" />,
    keywords: ['callout', 'box', 'avviso', 'nota', 'evidenza'],
  },
  {
    type: 'quote',
    title: 'Citazione',
    description: 'Riquadro per citazioni ed estratti di testo',
    icon: <Quote className="w-4 h-4 text-neutral-400" />,
    keywords: ['citazione', 'quote', 'frase'],
  },
  {
    type: 'page_link',
    title: 'Link a Pagina',
    description: 'Collega una nota o workspace nel flusso del testo',
    icon: <Link2 className="w-4 h-4 text-indigo-500" />,
    keywords: ['link', 'collegamento', 'pagina', 'workspace', 'nota', 'page'],
  },
];

interface SlashCommandMenuProps {
  searchQuery?: string;
  onSelect: (type: SlashItemType) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  searchQuery = '',
  onSelect,
  onClose,
  position,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanQuery = searchQuery.replace('/', '').toLowerCase().trim();
  const filteredItems = SLASH_ITEMS.filter((item) => {
    if (!cleanQuery) return true;
    return (
      item.title.toLowerCase().includes(cleanQuery) ||
      item.description.toLowerCase().includes(cleanQuery) ||
      item.keywords.some((kw) => kw.includes(cleanQuery))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [cleanQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? (filteredItems.length || 1) - 1 : prev - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex].type);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, selectedIndex, onSelect, onClose]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const style: React.CSSProperties = position
    ? {
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }
    : {};

  return (
    <div
      ref={containerRef}
      style={style}
      className="z-50 w-72 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-1 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
        Elementi & Blocchi
      </div>

      <div className="max-h-64 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-4 text-xs text-center text-neutral-400">
            Nessun blocco corrispondente a "{cleanQuery}"
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.type}
                onClick={() => onSelect(item.type)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-neutral-100 dark:bg-neutral-700/70 text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <div className="w-7 h-7 shrink-0 rounded-md bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center border border-neutral-200/60 dark:border-neutral-700">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface AutocompleteItem {
  id: string;
  label: string;
  icon?: string;
  description?: string;
}

interface AutocompleteComboboxProps {
  label: string;
  placeholder?: string;
  items: AutocompleteItem[];
  selectedId?: string;
  onSelect: (item: AutocompleteItem) => void;
  onCustomChange?: (query: string) => void;
  allowCustomInput?: boolean;
}

export const AutocompleteCombobox: React.FC<AutocompleteComboboxProps> = ({
  label,
  placeholder = 'Digita per cercare...',
  items,
  selectedId,
  onSelect,
  onCustomChange,
  allowCustomInput = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync query with current selection
  useEffect(() => {
    const selectedItem = items.find((item) => item.id === selectedId || item.label === selectedId);
    if (selectedItem) {
      setQuery(selectedItem.label);
    } else if (selectedId) {
      setQuery(selectedId);
    }
  }, [selectedId, items]);

  // Filter items based on user query
  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
  );

  // Handle clicking outside to dismiss the dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setHighlightedIndex(0);
    onCustomChange?.(val);
  };

  const handleSelectItem = (item: AutocompleteItem) => {
    setQuery(item.label);
    setIsOpen(false);
    onSelect(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        handleSelectItem(filteredItems[highlightedIndex]);
      } else if (allowCustomInput && query.trim()) {
        handleSelectItem({ id: query.trim(), label: query.trim() });
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1">
      <label
        style={{ color: 'var(--theme-text-muted)' }}
        className="block font-medium text-[11px] select-none"
      >
        {label}
      </label>

      {/* Input bar */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            backgroundColor: 'var(--theme-bg-app)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-main)',
          }}
          className="w-full pl-8 pr-8 py-2 text-xs border rounded-xl outline-none focus:ring-1 focus:ring-[var(--theme-accent)] transition-all font-medium"
        />

        {/* Search icon on left */}
        <div
          style={{ color: 'var(--theme-text-muted)' }}
          className="absolute left-2.5 pointer-events-none"
        >
          <Search className="w-3.5 h-3.5 opacity-60" />
        </div>

        {/* Dropdown toggle button on right */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }}
          style={{ color: 'var(--theme-text-muted)' }}
          className="absolute right-2 p-1 rounded hover:text-[var(--theme-text-main)] transition-colors"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown Suggestion List */}
      {isOpen && (
        <div
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'var(--theme-border)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.25)',
          }}
          className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto z-50 rounded-xl border py-1 animate-in fade-in zoom-in-95 duration-100"
        >
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const isSelected = item.id === selectedId || item.label === selectedId;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    backgroundColor: isHighlighted ? 'var(--theme-bg-hover)' : 'transparent',
                    color: 'var(--theme-text-main)',
                  }}
                  className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.icon && (
                      <span className="text-sm shrink-0 leading-none">{item.icon}</span>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.label}</div>
                      {item.description && (
                        <div
                          style={{ color: 'var(--theme-text-muted)' }}
                          className="text-[10px] truncate"
                        >
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check
                      style={{ color: 'var(--theme-accent)' }}
                      className="w-3.5 h-3.5 stroke-[2.5] shrink-0 ml-2"
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div
              style={{ color: 'var(--theme-text-muted)' }}
              className="px-3 py-3 text-center text-xs"
            >
              {allowCustomInput ? (
                <div
                  onClick={() => handleSelectItem({ id: query.trim(), label: query.trim() })}
                  className="cursor-pointer hover:underline text-[var(--theme-accent)]"
                >
                  Usa &quot;{query}&quot; come titolo personalizzato
                </div>
              ) : (
                'Nessun risultato trovato'
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

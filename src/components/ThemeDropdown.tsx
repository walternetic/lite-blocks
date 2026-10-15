import React, { useState, useRef, useEffect } from 'react';
import { THEMES, getThemeById, DEFAULT_THEME_ID } from '../lib/themes';
import { Sun, Moon, Check, Palette } from 'lucide-react';

interface ThemeDropdownProps {
  activeThemeId?: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectTheme: (themeId: string) => void;
}

export const ThemeDropdown: React.FC<ThemeDropdownProps> = ({
  activeThemeId,
  isDarkMode,
  onToggleDarkMode,
  onSelectTheme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTheme = getThemeById(activeThemeId || (isDarkMode ? 'tokyo-night' : DEFAULT_THEME_ID));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const darkThemes = THEMES.filter((t) => t.mode === 'dark');
  const lightThemes = THEMES.filter((t) => t.mode === 'light');

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Theme Trigger Button (Sun/Moon icon) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        style={{ color: 'var(--theme-text-muted)' }}
        className="p-1.5 rounded-md hover:text-[var(--theme-text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative"
        title={`Temi & Aspetto (${isDarkMode ? 'Scuro' : 'Chiaro'})`}
      >
        {isDarkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-main)',
          }}
          className="absolute right-0 top-full mt-1.5 z-50 w-64 border rounded-xl shadow-xl p-2.5 animate-in fade-in zoom-in-95 duration-100 text-xs"
        >
          {/* Header with Quick Dark/Light Switcher */}
          <div
            style={{ borderColor: 'var(--theme-border)' }}
            className="flex items-center justify-between pb-2 mb-2 border-b"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Palette className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--theme-accent)' }} />
              <span className="font-semibold text-xs truncate">
                {currentTheme.name}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onToggleDarkMode();
              }}
              style={{
                backgroundColor: 'var(--theme-bg-hover)',
                color: 'var(--theme-text-main)',
                borderColor: 'var(--theme-border)',
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium hover:opacity-90 transition-opacity"
              title={isDarkMode ? "Modalità scura attiva (clicca per passare a chiaro)" : "Modalità chiara attiva (clicca per passare a scuro)"}
            >
              {isDarkMode ? (
                <>
                  <Moon className="w-3 h-3 text-indigo-400" />
                  <span>Scuro</span>
                </>
              ) : (
                <>
                  <Sun className="w-3 h-3 text-amber-500" />
                  <span>Chiaro</span>
                </>
              )}
            </button>
          </div>

          {/* Theme Palette List (filtered exclusively by current mode) */}
          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-0.5">
            <div>
              <div
                style={{ color: 'var(--theme-text-muted)' }}
                className="px-1 mb-1 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between"
              >
                <span>{isDarkMode ? 'Temi Scuri' : 'Temi Chiari'}</span>
                <span className="font-mono text-[9px]">
                  {isDarkMode ? darkThemes.length : lightThemes.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {(isDarkMode ? darkThemes : lightThemes).map((theme) => {
                  const isSelected = currentTheme.id === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        onSelectTheme(theme.id);
                      }}
                      style={
                        isSelected
                          ? {
                              backgroundColor: 'var(--theme-bg-hover)',
                              color: 'var(--theme-text-main)',
                            }
                          : {
                              color: 'var(--theme-text-muted)',
                            }
                      }
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors hover:text-[var(--theme-text-main)] hover:bg-black/5 dark:hover:bg-white/5 text-left group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 2-tone swatch badge */}
                        <div
                          className="w-4 h-4 rounded-full border border-black/15 dark:border-white/20 flex items-center justify-center shrink-0 shadow-xs"
                          style={{ backgroundColor: theme.colors.bgSidebar }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: theme.colors.accent }}
                          />
                        </div>
                        <span className="truncate font-medium">{theme.name}</span>
                      </div>

                      {isSelected && (
                        <Check
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: 'var(--theme-accent)' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

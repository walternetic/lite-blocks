/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ContentWidthSetting,
  ConcreteContentWidth,
  CONCRETE_WIDTH_OPTIONS,
} from '../lib/contentWidth';
import { UnfoldHorizontal, Check } from 'lucide-react';

interface ContentWidthDropdownProps {
  currentSetting?: ContentWidthSetting;
  defaultWidth: ConcreteContentWidth;
  onSelectWidth: (width: ContentWidthSetting) => void;
  onSetDefaultWidth: (width: ConcreteContentWidth) => void;
}

export const ContentWidthDropdown: React.FC<ContentWidthDropdownProps> = ({
  currentSetting,
  defaultWidth,
  onSelectWidth,
  onSetDefaultWidth,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDefaultSelected = !currentSetting || currentSetting === 'default';

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectOption = (
    setting: ContentWidthSetting,
    e: React.MouseEvent
  ) => {
    const triggerResponsiveRefresh = () => {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 160);
      });
    };

    // If Ctrl (or Cmd) is pressed on a concrete value: set as global default!
    if ((e.ctrlKey || e.metaKey) && setting !== 'default') {
      e.preventDefault();
      e.stopPropagation();
      onSetDefaultWidth(setting as ConcreteContentWidth);
      triggerResponsiveRefresh();
      return;
    }

    // Normal click: set as per-page metadata value
    onSelectWidth(setting);
    setIsOpen(false);
    triggerResponsiveRefresh();
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Dropdown trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{ color: 'var(--theme-text-muted)' }}
        className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs font-mono hover:text-[var(--theme-text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        title={
          isDefaultSelected
            ? `Larghezza area contenuti: Predefinita workspace (${defaultWidth}) - Clicca per modificare`
            : `Larghezza area contenuti: ${currentSetting} (personalizzata per questa pagina) - Clicca per modificare`
        }
      >
        <UnfoldHorizontal className="w-3.5 h-3.5" />
        <span className="text-[11px]">
          {isDefaultSelected ? `Def (${defaultWidth})` : currentSetting}
        </span>
      </button>

      {/* Upward-opening popover menu */}
      {isOpen && (
        <div
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-main)',
          }}
          className="absolute right-0 bottom-full mb-1.5 z-50 w-64 border rounded-xl shadow-xl p-1.5 animate-in fade-in zoom-in-95 duration-100 text-xs select-none"
        >
          {/* Header */}
          <div
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
            className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b mb-1 flex items-center justify-between"
          >
            <span>Larghezza contenuti</span>
            <span className="font-mono lowercase text-[9px] opacity-75">
              {isDefaultSelected ? `Default WS: ${defaultWidth}` : `Pagina: ${currentSetting}`}
            </span>
          </div>

          {/* Default option */}
          <button
            type="button"
            onClick={(e) => handleSelectOption('default', e)}
            style={
              isDefaultSelected
                ? {
                    backgroundColor: 'var(--theme-bg-hover)',
                    color: 'var(--theme-text-main)',
                  }
                : {}
            }
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
              isDefaultSelected ? 'font-medium' : ''
            }`}
            title="Usa la larghezza predefinita del workspace per questa pagina"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                {isDefaultSelected && (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-mono leading-tight">
                  Default
                </div>
                <div
                  style={{ color: 'var(--theme-text-muted)' }}
                  className="text-[10px] truncate leading-tight mt-0.5 opacity-80"
                >
                  Eredita valore del workspace ({defaultWidth})
                </div>
              </div>
            </div>
            <span
              style={{
                color: 'var(--theme-text-muted)',
                backgroundColor: 'var(--theme-bg-app)',
              }}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-transparent shrink-0 ml-2"
            >
              {defaultWidth}
            </span>
          </button>

          {/* Divider */}
          <div
            style={{ borderColor: 'var(--theme-border)' }}
            className="my-1 border-t"
          />

          {/* Concrete Options list */}
          <div className="space-y-0.5">
            {CONCRETE_WIDTH_OPTIONS.map((opt) => {
              const isPageSelected = currentSetting === opt.id;
              const isGlobalDefault = defaultWidth === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) => handleSelectOption(opt.id, e)}
                  style={
                    isPageSelected
                      ? {
                          backgroundColor: 'var(--theme-bg-hover)',
                          color: 'var(--theme-text-main)',
                        }
                      : {}
                  }
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                    isPageSelected ? 'font-medium' : ''
                  }`}
                  title="Clicca per applicare a questa pagina. Ctrl+Click per impostare come Default per questo workspace."
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                      {isPageSelected && (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono leading-tight flex items-center gap-1.5">
                        <span>{opt.label}</span>
                        {isGlobalDefault && (
                          <span
                            className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold"
                            title="Attuale Default di questo workspace per le pagine senza override"
                          >
                            Default WS
                          </span>
                        )}
                      </div>
                      <div
                        style={{ color: 'var(--theme-text-muted)' }}
                        className="text-[10px] truncate leading-tight mt-0.5 opacity-80"
                      >
                        {opt.description}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      color: 'var(--theme-text-muted)',
                      backgroundColor: 'var(--theme-bg-app)',
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-transparent shrink-0 ml-2"
                  >
                    {opt.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Shortcut hint footer */}
          <div
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
            className="mt-1.5 pt-1.5 px-2 border-t text-[10px] leading-tight opacity-75"
          >
            <kbd className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[9px] font-semibold">
              Ctrl+Click
            </kbd>{' '}
            su un valore per impostarlo come Default del workspace.
          </div>
        </div>
      )}
    </div>
  );
};

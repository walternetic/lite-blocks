/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConcreteContentWidth = '44em' | '50%' | '75%' | '95%' | '100%';
export type ContentWidthSetting = 'default' | ConcreteContentWidth;

export interface ConcreteWidthOption {
  id: ConcreteContentWidth;
  label: string;
  badge: string;
  description: string;
  cssMaxWidth: string;
}

export const FALLBACK_DEFAULT_WIDTH: ConcreteContentWidth = '44em';

/**
 * Concrete width options.
 * Fixed 44em enforces a 44em max-width baseline.
 */
export const CONCRETE_WIDTH_OPTIONS: ConcreteWidthOption[] = [
  {
    id: '44em',
    label: 'Fixed 44em',
    badge: '44em',
    description: 'Larghezza fissa ottimale per la lettura',
    cssMaxWidth: '44em',
  },
  {
    id: '50%',
    label: '50%',
    badge: '50%',
    description: 'Metà dello spazio orizzontale disponibile',
    cssMaxWidth: '50%',
  },
  {
    id: '75%',
    label: '75%',
    badge: '75%',
    description: 'Tre quarti dello spazio disponibile',
    cssMaxWidth: '75%',
  },
  {
    id: '95%',
    label: '95%',
    badge: '95%',
    description: 'Quasi l\'intera larghezza della finestra',
    cssMaxWidth: '95%',
  },
  {
    id: '100%',
    label: '100%',
    badge: '100%',
    description: 'Massima ampiezza orizzontale dello schermo',
    cssMaxWidth: '100%',
  },
];

/**
 * Retrieve workspace-scoped default content width setting.
 * Fallback baseline is strictly '44em' (Fixed 44em).
 */
export function getWorkspaceDefaultContentWidth(
  workspaceMeta?: { defaultContentWidth?: ConcreteContentWidth } | null
): ConcreteContentWidth {
  if (
    workspaceMeta?.defaultContentWidth &&
    CONCRETE_WIDTH_OPTIONS.some((opt) => opt.id === workspaceMeta.defaultContentWidth)
  ) {
    return workspaceMeta.defaultContentWidth;
  }
  return FALLBACK_DEFAULT_WIDTH;
}

export const getDefaultContentWidth = getWorkspaceDefaultContentWidth;

/**
 * Resolve the concrete width for a page setting within a specific workspace.
 * If setting is 'default' or undefined, inherits the workspace default.
 * Backward compatible: maps legacy '700px' to '44em'.
 */
export function resolveEffectiveContentWidth(
  setting?: ContentWidthSetting | string | null,
  workspaceDefault?: ConcreteContentWidth
): ConcreteContentWidth {
  const fallback = workspaceDefault || FALLBACK_DEFAULT_WIDTH;
  if (!setting || setting === 'default') {
    return fallback;
  }
  if (setting === '700px') {
    return '44em';
  }
  if (CONCRETE_WIDTH_OPTIONS.some((opt) => opt.id === setting)) {
    return setting as ConcreteContentWidth;
  }
  return fallback;
}

/**
 * Resolve the CSS max-width value for a given content width setting in the active workspace.
 */
export function getContentWidthCss(
  setting?: ContentWidthSetting | string | null,
  workspaceDefault?: ConcreteContentWidth
): string {
  const effective = resolveEffectiveContentWidth(setting, workspaceDefault);
  switch (effective) {
    case '50%':
      return '50%';
    case '75%':
      return '75%';
    case '95%':
      return '95%';
    case '100%':
      return '100%';
    case '44em':
    default:
      return '44em';
  }
}

import React from 'react';
import { resolveCrossWorkspaceLink } from '../lib/workspaceStorage';

interface PageLinkBadgeProps {
  wsName: string;
  noteTitle?: string;
  customLabel?: string;
  onEdit: () => void;
}

export const PageLinkBadge: React.FC<PageLinkBadgeProps> = ({
  wsName,
  noteTitle,
  customLabel,
  onEdit,
}) => {
  const link = resolveCrossWorkspaceLink(wsName, noteTitle);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      e.preventDefault();
      onEdit();
    } else {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit();
  };

  return (
    <span
      role="link"
      tabIndex={0}
      contentEditable={false}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      data-liteblocks-link="true"
      data-workspace={link.workspaceName}
      data-note={link.noteTitle || ''}
      data-label={customLabel || link.noteTitle || ''}
      style={{
        backgroundColor: 'var(--theme-bg-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text-main)',
      }}
      className="page-link-badge inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-0.5 rounded-lg border text-xs font-medium cursor-pointer hover:border-[var(--theme-accent)] transition-all shadow-2xs align-middle group/link selection:bg-[var(--theme-accent)] selection:text-[var(--theme-accent-text)]"
      title={`Apri ${link.noteTitle ? `"${link.noteTitle}" (${link.workspaceName})` : `workspace "${link.workspaceName}"`} in una nuova scheda · Tasto destro o Shift+Clic: modifica`}
    >
      {/* Workspace Icon & Name */}
      <span className="text-xs shrink-0 leading-none">{link.workspaceIcon}</span>
      <span className="font-semibold text-[var(--theme-text-main)]">{link.workspaceName}</span>

      {/* Page Icon & Title (rendered only if a note title or custom label is present) */}
      {(link.noteTitle || customLabel) && (
        <>
          <span style={{ color: 'var(--theme-text-muted)' }} className="font-normal">
            /
          </span>
          {link.noteIcon && <span className="text-xs shrink-0 leading-none">{link.noteIcon}</span>}
          <span className="truncate max-w-[200px] group-hover/link:underline">
            {customLabel || link.noteTitle}
          </span>
        </>
      )}
    </span>
  );
};

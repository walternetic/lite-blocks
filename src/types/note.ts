export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'todo'
  | 'code'
  | 'image'
  | 'file'
  | 'callout'
  | 'quote';

export interface NoteBlock {
  id: string;
  type: BlockType;
  content: string;
  completed?: boolean;
  language?: string;
  caption?: string;
  fileName?: string;
  fileSize?: number; // size in bytes
  fileType?: string; // mime type
  fileUrl?: string;  // data URL or remote URL
  icon?: string;     // icon for callout
}

export type ConcreteContentWidth = '44em' | '50%' | '75%' | '95%' | '100%';
export type ContentWidthSetting = 'default' | ConcreteContentWidth;

export interface Note {
  id: string;
  workspaceId: string;
  userId?: string;
  title: string;
  icon?: string;
  coverUrl?: string;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  blocks: NoteBlock[];
  contentWidth?: ContentWidthSetting;
}

export interface WorkspaceMeta {
  id: string;
  name: string;
  icon: string;
  themeId?: string;
  defaultContentWidth?: ConcreteContentWidth;
  createdAt: number;
  updatedAt: number;
}

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error';
export type WorkspaceStatus = 'active' | 'unloaded';

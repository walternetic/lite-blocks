import { Note, WorkspaceMeta } from '../types/note';

export const INITIAL_WORKSPACES: WorkspaceMeta[] = [
  {
    id: 'ws-personal',
    name: 'Personale',
    icon: '🌿',
    themeId: 'forest-sage',
    createdAt: Date.now() - 3600000 * 48,
    updatedAt: Date.now() - 3600000 * 2,
  },
  {
    id: 'ws-dev',
    name: 'Progetti Dev',
    icon: '💻',
    themeId: 'tokyo-night',
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 1,
  },
  {
    id: 'ws-ideas',
    name: 'Idee & Ricerca',
    icon: '💡',
    themeId: 'nord',
    createdAt: Date.now() - 3600000 * 12,
    updatedAt: Date.now() - 3600000 * 3,
  },
];

export const INITIAL_NOTES: Note[] = [
  {
    id: 'c7b12d5e-4a6f-40e1-b85f-829d81d29c41',
    workspaceId: 'ws-personal',
    title: 'Benvenuto in Lite Blocks 🚀',
    icon: '🚀',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
    isFavorite: true,
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 60000,
    blocks: [
      {
        id: 'b-1',
        type: 'heading1',
        content: 'Il tuo taccuino multimediale veloce',
      },
      {
        id: 'b-2',
        type: 'paragraph',
        content:
          'Lite Blocks è un block based editor minimale ed elegante, progettato per essere immediato e privo di distrazioni. Ispirato all’esperienza e alla flessibilità dei moderni block based editor, ti permette di comporre testi, organizzare to-do list, inserire snippet di codice formattato, foto e documenti allegati.',
      },
      {
        id: 'b-3',
        type: 'callout',
        content: 'Novità Workspace: Ora hai spazi isolati aperti come siti virtuali autonomi! Prova ad aprire il link a un altro workspace: [[Progetti Dev/Architettura Sistema]] oppure premi Ctrl/Cmd + K per cercare in tutti i workspace.',
        icon: '💡',
      },
      {
        id: 'b-4',
        type: 'heading2',
        content: 'Checklist interattiva (To-Do)',
      },
      {
        id: 'b-5',
        type: 'todo',
        content: 'Esplora la barra laterale per cercare le note in tempo reale',
        completed: true,
      },
      {
        id: 'b-6',
        type: 'todo',
        content: 'Fai clic sul selettore Workspace in alto a sinistra per cambiare ambiente in-line',
        completed: false,
      },
      {
        id: 'b-7',
        type: 'todo',
        content: 'Sperimenta il tasto "Scarica dalla memoria" per liberare RAM e socket',
        completed: false,
      },
      {
        id: 'b-8',
        type: 'heading2',
        content: 'Blocchi di Codice con Copia Veloce',
      },
      {
        id: 'b-9',
        type: 'code',
        language: 'typescript',
        content: `// Isolamento architetturale rigoroso
export interface WorkspacePartition {
  workspaceId: string;
  isLoaded: boolean;
  notesInMemory: number;
}`,
      },
      {
        id: 'b-10',
        type: 'heading2',
        content: 'Immagini e Didascalie',
      },
      {
        id: 'b-11',
        type: 'image',
        content:
          'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80',
        caption: 'Spazio di lavoro minimale con taccuino e laptop',
      },
      {
        id: 'b-12',
        type: 'heading2',
        content: 'Allegati e Documenti File',
      },
      {
        id: 'b-13',
        type: 'file',
        content: '',
        fileName: 'Guida_Lite_Blocks_Scorciatoie.pdf',
        fileSize: 245760, // ~240 KB
        fileType: 'application/pdf',
      },
    ],
  },
  {
    id: 'e3f89a12-5b7c-48d9-a031-1f92e4b6c8d7',
    workspaceId: 'ws-personal',
    title: 'Diario e Riflessioni Personali 📖',
    icon: '📖',
    coverUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80',
    isFavorite: false,
    createdAt: Date.now() - 3600000 * 20,
    updatedAt: Date.now() - 3600000 * 4,
    blocks: [
      {
        id: 'b-j1',
        type: 'heading1',
        content: 'Note Personali',
      },
      {
        id: 'b-j2',
        type: 'paragraph',
        content:
          'Questo spazio è completamente isolato dal workspace di lavoro. Le note qui presenti rimangono riservate.',
      },
      {
        id: 'b-j3',
        type: 'todo',
        content: 'Pianificare le vacanze estive',
        completed: false,
      },
    ],
  },
];

// Sample notes for other workspaces (loaded strictly when that workspace is activated)
export const SAMPLE_DEV_NOTES: Note[] = [
  {
    id: 'f4a91b23-6c8d-49ea-b142-2a03f5c7d9e8',
    workspaceId: 'ws-dev',
    title: 'Architettura Sistema 🛠️',
    icon: '🛠️',
    coverUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
    isFavorite: true,
    createdAt: Date.now() - 3600000 * 18,
    updatedAt: Date.now() - 3600000 * 2,
    blocks: [
      {
        id: 'b-d1',
        type: 'heading1',
        content: 'Specifiche e Pipeline Microservizi',
      },
      {
        id: 'b-d2',
        type: 'paragraph',
        content:
          'Workspace dedicato all’ingegneria software. Questo workspace è un sito virtuale isolato. Se questo spazio contiene 100.000 righe, gli altri workspace non risentiranno minimamente dell’overhead.',
      },
      {
        id: 'b-d3',
        type: 'callout',
        content: 'Riferimento al diario personale: [[Personale/Diario e Riflessioni Personali 📖]]',
        icon: '🔗',
      },
      {
        id: 'b-d4',
        type: 'code',
        language: 'typescript',
        content: `// Partition storage loader
export async function loadWorkspaceNotes(wsId: string): Promise<Note[]> {
  const local = localStorage.getItem(\`liteblocks_ws_\${wsId}_notes\`);
  return local ? JSON.parse(local) : [];
}`,
      },
    ],
  },
];

export const SAMPLE_IDEAS_NOTES: Note[] = [
  {
    id: 'a5b02c34-7d9e-4afb-c253-3b14a6d8e0f9',
    workspaceId: 'ws-ideas',
    title: 'Brainstorming Nuovi Prodotti 💡',
    icon: '💡',
    coverUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
    isFavorite: false,
    createdAt: Date.now() - 3600000 * 10,
    updatedAt: Date.now() - 3600000 * 1,
    blocks: [
      {
        id: 'b-i1',
        type: 'heading1',
        content: 'Idee Innovative 2026',
      },
      {
        id: 'b-i2',
        type: 'paragraph',
        content: 'Spazio dedicato alla ricerca concettuale e validazione rapida in un block based editor moderno.',
      },
    ],
  },
];

export const PRESET_COVERS = [
  {
    name: 'Minimal Travertino',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Architettura Moderna',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Natura & Nebbia',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Notte Astratta',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Scrivania Zen',
    url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1600&q=80',
  },
];

export const COMMON_EMOJIS = [
  '📝', '🚀', '💡', '🎯', '📚', '⚡', '🎨', '🔬', '💻', '☕', 
  '📂', '🌟', '🏷️', '📌', '🛠️', '📊', '🎧', '🔑', '🌱', '🌍'
];

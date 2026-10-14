# Technical Specifications (SPECS.md) — Lite Blocks

## 1. System Architecture & Module Boundaries

Lite Blocks is structured as a client-side single-page application built on React 19, TypeScript, and Tailwind CSS, bundled with Vite.

```
+-----------------------------------------------------------------------------------+
|                                 Lite Blocks SPA                                   |
|                                                                                   |
|  +------------------------+  +-------------------------------------------------+  |
|  |       Sidebar          |  |                   EditorArea                    |  |
|  | - WorkspaceSelector    |  | - EditorHeader (Sticky, Title, Metadata)       |  |
|  | - ThemeDropdown        |  | - BlockRenderer (H1-H3, Todo, Code, Callout)   |  |
|  | - Accordion Notes      |  +-------------------------------------------------+  |
|  | - Footer: Memory & Ver |                                                       |
|  +------------------------+                                                       |
+-----------------------------------------------------------------------------------+
                                         |
     +-----------------------------------+-----------------------------------+
     |                                   |                                   |
     v                                   v                                   v
+-----------------------+     +-----------------------+     +-----------------------+
|  Local Storage / IndexedDB  |  Firebase Cloud Sync  |  Theme Engine (:root vars) |
+-----------------------+     +-----------------------+     +-----------------------+
```

---

## 2. Semantic Versioning Automation Specification

### 2.1 Standard & Lifecycle
The versioning engine implements SemVer 2.0.0 (`MAJOR.MINOR.PATCH`).
- Initial baseline: `0.1.0`.
- Automated evaluation occurs via `scripts/bump-version.mjs` executed either:
  1. Automatically by Git hooks (`.git/hooks/commit-msg`) on commit creation.
  2. Programmatically via npm lifecycle scripts (`npm run version:bump`).

### 2.2 Conventional Commits Grammar & Version Mapping

The script parses commit messages matching the Conventional Commits 1.0.0 specification:
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

| Commit Pattern | Detection Logic | SemVer Action | Example |
| :--- | :--- | :--- | :--- |
| **Breaking Change** | Header contains `!:` (e.g., `feat!:`) OR body/footer contains `BREAKING CHANGE:` | **MAJOR** (`X+1.0.0`) | `feat!: remove deprecated storage API` |
| **Feature** | Header starts with `feat:` or `feat(...):` | **MINOR** (`x.Y+1.0`) | `feat(sidebar): add theme selector dropdown` |
| **Fix / Patch** | Header starts with `fix`, `perf`, `refactor`, `style`, `chore`, `docs`, `test` | **PATCH** (`x.y.Z+1`) | `fix(theme): enhance text contrast ratio` |

### 2.3 Synchronized File Targets

When a version bump occurs, the script atomically updates:
1. `package.json`: Updates `"version": "x.y.z"`.
2. `package-lock.json`: Updates root `"version": "x.y.z"` and `packages[""]["version"]`.
3. `metadata.json`: Updates/inserts `"version": "x.y.z"`.
4. `src/version.ts`: Generates a TypeScript module:
   ```typescript
   export const APP_VERSION = 'x.y.z';
   export const APP_BUILD_TIME = '2026-10-14T19:35:00.000Z';
   ```

### 2.4 Command-Line Interface (`scripts/bump-version.mjs`)

The bump script accepts the following flags:
- `--type=<patch|minor|major>`: Explicit component increment.
- `--from-msg="<string>"`: Analyzes the provided string against Conventional Commits rules.
- `--from-msg-file="<path>"`: Reads commit message from file (used by `.git/hooks/commit-msg`).
- `--auto`: Inspects `git log -1 --pretty=%B` if available, falling back to `patch`.
- `--dry-run`: Computes and logs the next version without writing files.

---

## 3. UI Version Presentation Contract

In [`src/components/Sidebar.tsx`](src/components/Sidebar.tsx), the active application version is imported from `src/version.ts` and rendered in the bottom footer bar:
- **Element**: Compact monospace badge (`text-[10px] font-mono px-1.5 py-0.5 rounded`).
- **Styling**: `color: var(--theme-text-muted)` with hover transitioning to `var(--theme-text-main)`.
- **Tooltip**: Displays `Versione x.y.z (SemVer 2.0.0)`.

---

## 4. Theme Engine Contract

All visual surfaces consume dynamic CSS Custom Properties declared on `:root`:
- `--theme-bg-app`: Root viewport background.
- `--theme-bg-sidebar`: Navigation drawer background.
- `--theme-bg-surface`: Cards, dropdowns, inputs, and active note backgrounds.
- `--theme-bg-hover`: Hover states and subtle badges.
- `--theme-border`: Divider and bounding borders.
- `--theme-text-main`: Primary content (contrast ratio >= 4.5:1, WCAG AA).
- `--theme-text-muted`: Secondary metadata and placeholders (contrast ratio >= 4.5:1).
- `--theme-accent`: Focus rings and brand indicators.
- `--theme-accent-text`: Text on top of accent backgrounds.

---

## 5. Editor Block Focus & Enter Key Split Contract

### 5.1 Focus Management State Machine (`FocusTarget`)
Focus navigation between blocks is coordinated via a reactive state target in `App.tsx`:
```typescript
interface FocusTarget {
  id: string;
  cursorPosition?: 'start' | 'end' | number;
}
```
- When a block is inserted (via Enter or bottom placeholder), `focusedBlockTarget` is set to `{ id: newBlock.id, cursorPosition: 'start' }`.
- When an empty block is removed (via Backspace), `focusedBlockTarget` is set to `{ id: prevBlock.id, cursorPosition: 'end' }`.
- Props passed to `BlockRenderer`:
  - `autoFocus`: `boolean` (`focusedBlockTarget?.id === block.id`).
  - `focusPosition`: `'start' | 'end' | number` (`focusedBlockTarget?.cursorPosition`).
  - `onFocusHandled`: Callback to reset `focusedBlockTarget` to `null` once focus is bound.

### 5.2 Atomic Splitting Contract
`handleInsertBlockBelow` executes an atomic state mutation:
```typescript
handleInsertBlockBelow(
  type: BlockType,
  afterIndex: number,
  currentBlockContent?: string,
  newBlockContent: string = ''
): void
```
1. Updates `blocks[afterIndex].content` with text before cursor (`currentBlockContent`).
2. Creates `newBlock` with text after cursor (`newBlockContent`) and type inherited from context (e.g. `todo` creates `todo`, headings/quotes/paragraphs create `paragraph`).
3. Splices `newBlock` into index `afterIndex + 1`.
4. Sets `focusedBlockTarget` to `{ id: newBlock.id, cursorPosition: 'start' }`.
5. Emits a single consolidated update to note persistence to prevent stale state races.

### 5.3 Content Merge Contract (Backspace & Delete)

#### 5.3.1 Backspace at Block Start (`handleMergeWithPrevious`)
- **Trigger**: `e.key === 'Backspace'` when `selectionStart === 0 && selectionEnd === 0` and `currentIndex > 0`.
- **Preconditions**: Both `blocks[currentIndex - 1]` and `blocks[currentIndex]` are text-compatible (`type !== 'image' && type !== 'file'`).
- **Algorithm**:
  1. Record boundary position: `cursorPosition = prevBlock.content.length`.
  2. Compute merged string: `mergedContent = prevBlock.content + currentBlock.content`.
  3. Mutate previous block: `blocks[currentIndex - 1] = { ...prevBlock, content: mergedContent }`. Note: strictly `content` is merged; the previous block preserves its original `type`, `completed`, and metadata.
  4. Splice out current block: `blocks.splice(currentIndex, 1)`.
  5. Set focus target: `setFocusedBlockTarget({ id: prevBlock.id, cursorPosition })`.
  6. Emit consolidated update to note persistence.

#### 5.3.2 Delete at Block End (`handleMergeWithNext`)
- **Trigger**: `e.key === 'Delete'` when `selectionStart === currentLength && selectionEnd === currentLength` and `currentIndex < totalBlocks - 1`.
- **Preconditions**: Both `blocks[currentIndex]` and `blocks[currentIndex + 1]` are text-compatible.
- **Algorithm**:
  1. Record boundary position: `cursorPosition = currentBlock.content.length`.
  2. Compute merged string: `mergedContent = currentBlock.content + nextBlock.content`.
  3. Mutate current block: `blocks[currentIndex] = { ...currentBlock, content: mergedContent }`. Note: strictly `content` is merged; the current block preserves its original `type`, `completed`, and metadata.
  4. Splice out subsequent block: `blocks.splice(currentIndex + 1, 1)`.
  5. Set focus target: `setFocusedBlockTarget({ id: currentBlock.id, cursorPosition })`.
  6. Emit consolidated update to note persistence.

---

## 6. Inline Page Link Component & Contextual Editor Specification

### 6.1 Architectural Topology
Page links are embedded directly into paragraph and text blocks as horizontal inline-flex visual components (`PageLinkBadge`), eliminating vertical detached list containers.

```
+-------------------------------------------------------------------------------+
| Paragraph Block Container (leading-relaxed, color: var(--theme-text-main))   |
|                                                                               |
|  "Check documentation at "                                                   |
|  +-------------------------------------------------------------------------+  |
|  | PageLinkBadge (inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg) |  |
|  | [ 📁 Workspace / 📄 Note Title ]                                        |  |
|  +-------------------------------------------------------------------------+  |
|  " for further instructions."                                                 |
+-------------------------------------------------------------------------------+
```

### 6.2 Data Representation & Wikilink Grammar
Inline links are persisted in `block.content` using an extended Wikilink syntax:
- Standard target: `[[workspaceName/noteTitle]]` or `[[workspaceName]]`
- Target with custom display title: `[[workspaceName/noteTitle|customLabel]]`

### 6.3 Interaction Contracts
1. **Left-Click (`onClick`)**:
   - Resolves target link via `resolveCrossWorkspaceLink(wsName, noteTitle)`.
   - Opens destination in a new browser tab (`window.open(link.url, '_blank')`).
2. **Right-Click (`onContextMenu`) & Shift+Click (`onClick + e.shiftKey`)**:
   - Prevents native context menu or standard navigation (`e.preventDefault()`, `e.stopPropagation()`).
   - Activates `PageLinkModal` targeting the specific link occurrence.
3. **Modal Editor Interface (`PageLinkModal`)**:
   - Allows selecting workspace destination from active manifests.
   - Allows selecting target note from loaded partition notes.
   - Allows defining or modifying custom display label (`customLabel`).
   - On save, atomically updates `block.content` replacing the matched raw wikilink token.
   - Supports link removal (restoring plain title text).

### 6.4 Tag Closing Trigger Mechanics
When typing in any block editor (either `<textarea>` or `InlineRichEditor`):
1. **Detection**: An incremental parser monitors character insertion. When a closing sequence `]]` is completed (closing a preceding `[[`), the editor intercepts the completion before resolving any default target.
2. **Modal Invocation**: Instead of silently mapping to a default note, `PageLinkModal` opens automatically with `initialWsName` and `initialNoteTitle` prefilled from whatever path segment was typed inside `[[...]]`.
3. **Atomic Replacement**: On user confirmation in the modal, the typed `[[...]]` token is replaced with the explicitly confirmed `[[workspace/note|label]]` markup.

### 6.5 Autocomplete Combobox Architecture
The static HTML `<select>` dropdowns in `PageLinkModal` are replaced by interactive `AutocompleteCombobox` components:
- **Searchable Input**: Users can type arbitrary substrings to filter available workspaces and documents.
- **Dynamic Suggestions Dropdown**: Renders filtered matches with workspace/note icons and titles, highlighting matching substrings.
- **Keyboard Navigation**: Supports `ArrowDown`, `ArrowUp`, `Enter` to select, and `Escape` to close the suggestion list.
- **Cascading Context**: Selecting a workspace automatically filters and reloads the available notes for that workspace partition.

### 6.6 Text Selection & Highlighting Specification
To ensure page link badges behave as integral text elements:
- **Selectability**: The badge container omits `user-select: none`, allowing standard browser text selection ranges (`window.getSelection()`) to span across badges atomically.
- **Visual Highlighting**: Badges apply CSS `::selection` styling matching the document accent palette (`var(--theme-accent)` background and `var(--theme-accent-text)`). In addition, when contained within an active DOM selection range, an active selection highlight ring is applied.

---

## 7. Unified Multi-MIME Clipboard Specification (`src/lib/clipboard.ts`)

### 7.1 Copy Serialization Protocol
When a copy operation occurs within any document block:
1. **Plain Text (`text/plain`)**:
   - Wikilink badges are serialized to their standard bracketed grammar: `[[workspace/note|customLabel]]` or `[[workspace/note]]`.
   - Regular text nodes preserve literal formatting and newlines.
2. **Rich HTML (`text/html`)**:
   - Wikilink badges are serialized as semantic anchor elements:
     ```html
     <a href="?ws=workspace&note=noteId" data-liteblocks-link="true" data-workspace="workspace" data-note="note" data-label="customLabel">customLabel</a>
     ```
   - Regular text is escaped with paragraph/line-break wrappers.
3. Both MIME representations are synchronously registered via `clipboardData.setData('text/plain', plainText)` and `clipboardData.setData('text/html', htmlText)`.

### 7.2 Paste Discrimination Protocol
1. **Forced Plain Text Paste (`Ctrl+Shift+V` / Single MIME Type)**:
   - When plain text paste is detected (via shortcut key tracking or when `text/html` is absent), the system reads strictly `clipboardData.getData('text/plain')`.
   - The payload is inserted literally at the cursor without regex parsing, link conversion, or transformation.
2. **Standard Paste (`Ctrl+V`)**:
   - When standard paste is executed and `text/html` is available in `clipboardData`:
     - The HTML is parsed with `DOMParser`.
     - Anchor elements (`<a ...>`) possessing `data-liteblocks-link`, cross-workspace route parameters, or valid URLs are converted into native `[[workspace/note|label]]` wikilink tokens.
     - The converted plain string is inserted into the active block, immediately triggering the inline page link renderer.

### 7.3 Uniform Applicability Across Block Types
The clipboard handlers (`handleBlockCopy`, `handleBlockPaste`) are applied uniformly across:
- Paragraph blocks
- Heading blocks (H1, H2, H3)
- Checklist blocks (To-do)
- Quote blocks
- Callout blocks
- Code blocks (preserving plain text code copying)

### 7.4 Block Handle Clipboard Operations & Parallel Local Clipboard Architecture
The application implements an in-memory and persistent local clipboard running in parallel with the host operating system clipboard:

1. **Local Clipboard Store Specification (`src/lib/clipboard.ts`)**:
   - **Data Contract (`LocalClipboardItem`)**: `{ text: string; html?: string; timestamp: number; block?: Partial<NoteBlock> }`.
   - **Persistence & Cross-Tab Synchronization**: Cached in-memory and mirrored into `localStorage` (`liteblocks_local_clipboard`). Listens to `window` `'storage'` events to guarantee cross-tab state coherence.
   - **Reactive Hook (`useLocalClipboard`)**: Utilizes React's `useSyncExternalStore` (`subscribeLocalClipboard`, `getLocalClipboard`) to expose `hasContent` and the active snapshot, preventing stale state or hydration mismatches.
2. **Dual-Target Copy ("Copia")**:
   - Invokes `handleCopyBlock()` or code block `handleCopyCode()`.
   - Serializes the active `block.content` using `buildMultiMimeClipboard()`.
   - Captures the complete block definition `blockData` (retaining `type`, `content`, `language` for code blocks, `completed` for todos, `caption` for media, and related metadata).
   - Synchronously updates the local clipboard via `setLocalClipboard({ text: plain, html, block: blockData })`.
   - Concurrently populates the host system clipboard (`navigator.clipboard.write([new ClipboardItem(...)])` or `writeText(plain)`).
3. **Local Paste Below ("Incolla sotto")**:
   - Gated by `hasLocalClipboardContent`: disabled with `opacity-40 cursor-not-allowed` when the local clipboard is empty.
   - When triggered, synchronously inspects `getLocalClipboard()`:
     - If `local.block` is present: instantiates an identical new block of the exact same `type`, retaining its specific configuration (e.g. `language` for code blocks, `completed` state for todos) and content, assigned with an algorithmic unique identifier `b-${Date.now()}-${random}`.
     - If only raw text is present: defaults to a text block containing `local.text`.
   - Invokes `onInsertBelow(local.block.type, index, undefined, local.block.content, local.block)`.
4. **Conventional Flyout Submenu ("Altre..") & Hover Stability Architecture**:
   - **Hit-Test Bridge**: The submenu card incorporates an invisible pseudo-element bridge (`before:absolute before:-left-3 before:top-0 before:bottom-0 before:w-3 before:content-['']`) eliminating the interactive dead zone created by the spatial gap (`ml-1`), so the cursor never leaves the element hierarchy during straight-line traversal.
   - **Temporal Grace Period (150ms Debounce)**: Submenu dismissal is managed by `handleSubMenuLeave` via a 150ms timer (`subMenuTimeoutRef`). Any pointer re-entry via `handleSubMenuEnter` immediately clears the timer, accommodating natural diagonal mouse movement toward lower items without premature collapse.
   - **Click-Outside Dismissal**: The options dropdown menu (`showOptionsMenu`) is detached from the block row's `onMouseLeave`, relying strictly on a document `mousedown` click-outside listener (`optionsContainerRef`), keeping the options menu open and stable until intentional outside interaction.
5. **Replace with Clipboard ("Sostituisci con clipboard")**:
   - Renamed from "Incolla sopra" and positioned as the top action within "Altre..".
   - Gated by `hasLocalClipboardContent`: disabled with `opacity-40 cursor-not-allowed` when local clipboard is empty.
   - When triggered:
     - If `local.block` is present: mutates the active block in-place to the identical type, content, language, and metadata of `local.block`, preserving the active block's `id`.
     - If only raw text is present: replaces `content: local.text` without altering block type.

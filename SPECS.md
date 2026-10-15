# Technical Specifications (SPECS.md) — Lite Blocks

## 1. System Architecture & Module Boundaries

Lite Blocks is structured as a client-side single-page application built on React 19, TypeScript, and Tailwind CSS, bundled with Vite.

```
+-----------------------------------------------------------------------------------+
|                                 Lite Blocks SPA                                   |
|                                                                                   |
|  +------------------------+  +-------------------------------------------------+  |
|  |       Sidebar          |  |                   EditorArea                    |  |
|  | - WorkspaceSelector    |  | Scroll Container:                               |  |
|  | - ThemeDropdown        |  | - EditorHeader (Cover, Title, Document Meta)    |  |
|  | - Accordion Notes      |  | - BlockRenderer (H1-H3, Todo, Code, Callout)   |  |
|  |                        |  +-------------------------------------------------+  |
|  |------------------------|  |-------------------------------------------------|  |
|  | Footer (h-10):         |  | EditorFooter (h-10):                            |  |
|  | - Local/Cloud, RAM, vX |  | - Sidebar Toggle, Sync, Star, Export, Delete   |  |
|  +------------------------+  +-------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
<========================= CONTINUOUS BORDER-T BASELINE ============================>
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

### 5.4 Block Deletion Shortcut Specification (`Alt+Delete`)

#### 5.4.1 Keyboard Event Interception: Alt+Delete vs. Shift+Delete (WM_CUT)
- **Alt+Delete (Block Deletion)**:
  - `(e.key === 'Delete' || e.key === 'Del') && e.altKey`.
  - Always deletes the current block regardless of text selection.
  - `e.preventDefault()` cancels browser forward-word deletion.
  - Calls `onDelete(block.id)` across all block implementations (textareas, `InlineRichEditor`, code block, image caption).
- **Shift+Delete & Ctrl+X (WM_CUT Emulation)**:
  - `(e.key === 'Delete' || e.key === 'Del') && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey`.
  - **With Selection**: Performs an immediate `WM_CUT` operation: extracts selected text/wikilinks, populates dual-MIME system clipboard and local clipboard, splices out selection from document state, repositions caret, and prevents default event.
  - **Without Selection**: No-op (does not delete block or modify clipboard).

#### 5.4.2 Deterministic Focus Target Migration
In `handleDeleteBlock(blockId)` in `src/App.tsx`:
1. Locates `index = activeNote.blocks.findIndex(b => b.id === blockId)`.
2. Computes `newBlocks = activeNote.blocks.filter(b => b.id !== blockId)`.
3. If `newBlocks.length === 0`:
   - Fallback empty block is created: `[{ id: 'b-' + Date.now(), type: 'paragraph', content: '' }]`.
   - Focus is assigned to the new block: `setFocusedBlockTarget({ id: fallbackBlock.id, cursorPosition: 'end' })`.
4. If `newBlocks.length > 0`:
   - Target index is computed as `targetIndex = Math.max(0, index - 1)` (preceding block, or new first block if deleting index 0).
   - Focus is assigned: `setFocusedBlockTarget({ id: newBlocks[targetIndex].id, cursorPosition: 'end' })`.

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
4. **Conventional Flyout Submenu ("Altre.."), Hover Stability & Viewport Anti-Collision Architecture**:
   - **Hit-Test Bridge**: The submenu card incorporates an invisible pseudo-element bridge (`before:absolute before:-left-3 before:top-0 before:bottom-0 before:w-3 before:content-['']` when opening right, or `before:-right-3 before:left-auto` when inverted left) eliminating the interactive dead zone created by the spatial gap (`ml-1`/`mr-1`), so the cursor never leaves the element hierarchy during straight-line traversal.
   - **Temporal Grace Period (150ms Debounce)**: Submenu dismissal is managed by `handleSubMenuLeave` via a 150ms timer (`subMenuTimeoutRef`). Any pointer re-entry via `handleSubMenuEnter` immediately clears the timer, accommodating natural diagonal mouse movement toward lower items without premature collapse.
   - **Click-Outside Dismissal**: The options dropdown menu (`showOptionsMenu`) is detached from the block row's `onMouseLeave`, relying strictly on a document `mousedown` click-outside listener (`optionsContainerRef`), keeping the options menu open and stable until intentional outside interaction.
   - **Dynamic Viewport Anti-Collision**:
     - *Main Options Menu*: Computes `spaceBelow = window.innerHeight - triggerRect.bottom - 8`. If `spaceBelow < 280` and `spaceAbove > spaceBelow`, flips the menu upward (`bottom-full mb-1 origin-bottom-left`). Retains natural `overflow: visible` (omitting internal scrollbars) and elevates its container stacking context to `z-40` when active (`${showOptionsMenu ? 'z-40' : 'z-20'}`), ensuring nested flyout submenus can extend outside the parent boundary without being clipped or trapped into a horizontal scroll container.
     - *Flyout Submenu*: Computes `spaceRight = window.innerWidth - triggerRect.right - 8` and `spaceBelow = window.innerHeight - triggerRect.top - 8`. If `spaceRight < 240`, inverts horizontal placement to the left (`right-full mr-1`). If `spaceBelow < 200`, aligns vertical placement upward (`bottom-0 top-auto`). Clamps height with `max-h-[calc(100vh-32px)] overflow-y-auto`.
5. **Replace with Clipboard ("Sostituisci con clipboard")**:
   - Renamed from "Incolla sopra" and positioned as the top action within "Altre..".
   - Gated by `hasLocalClipboardContent`: disabled with `opacity-40 cursor-not-allowed` when local clipboard is empty.
   - When triggered:
     - If `local.block` is present: mutates the active block in-place to the identical type, content, language, and metadata of `local.block`, preserving the active block's `id`.
     - If only raw text is present: replaces `content: local.text` without altering block type.
6. **Main Menu Deletion Action ("Elimina")**:
   - Exposed directly at the base of the main options menu (`showOptionsMenu`), distinguished by a separator divider and destructive styling (`text-rose-600 dark:text-rose-400 hover:bg-rose-50`).
   - Displays an inline monospace badge indicating the keyboard trigger (`Alt+Del`).
   - Invokes `onDelete(block.id)` and immediately dismisses the menu. Redundant duplication is purged from the "Altre.." submenu.

### 7.5 Universal Cut Operation Protocol (`WM_CUT`: `Shift+Delete` & `Ctrl+X`)

#### 7.5.1 Dual-MIME & Local Clipboard Serialization (`writeMultiMimeToClipboard`)
When a cut is triggered:
1. Slices the active selection:
   - `<textarea>`: `textarea.value.slice(selectionStart, selectionEnd)`.
   - `InlineRichEditor`: clones the range contents, extracting text nodes and converting badge DOM nodes (`data-link-raw`) to their wikilink markup (`[[ws/note|label]]`).
2. Invokes `writeMultiMimeToClipboard(selectedText, clipboardEvent)`:
   - Synchronously updates `localClipboard` with `{ text: plain, html }`.
   - If in `onCut` event: synchronously sets `clipboardData.setData('text/plain', plain)` and `clipboardData.setData('text/html', html)`.
   - If in `onKeyDown` (`Shift+Delete`): invokes `navigator.clipboard.write([new ClipboardItem(...)])` (with fallback to `writeText(plain)`).

#### 7.5.2 Atomic Splice & Caret Positioning
Because setting custom multi-MIME clipboard payloads requires `e.preventDefault()`, native browser text deletion is cancelled. The application guarantees explicit atomic deletion:
- `<textarea>`: Computes `updated = value.slice(0, start) + value.slice(end)`, emits `onUpdate({ ...block, content: updated })`, and schedules `textarea.setSelectionRange(start, start)` via `requestAnimationFrame`.
- `InlineRichEditor`: Computes character offset before deletion via `getCaretCharacterOffset`, calls `range.deleteContents()`, re-serializes via `serializeDomContent`, emits `onUpdate`, re-renders the DOM, and restores caret via `setCaretCharacterOffset(container, offset)`.

### 7.6 Text Block Auto-Resizing & Zero-Scrollbar Invariant

#### 7.6.1 Cause & Layout Mechanics
Default user-agent stylesheets apply `overflow: auto` to `<textarea>` elements. When multi-line text is rendered with fractional line heights (`leading-relaxed`, line-height `1.625` on `14px` font = `22.75px` per line), 3 lines require `68.25px`. Because DOM `scrollHeight` is an integer (`68px`), setting `style.height = 68px` produces a subpixel overflow (`68.25px > 68px`), triggering the browser's scrollbar.

#### 7.6.2 Technical Mitigation Contract
1. **Mandatory Overflow Suppression**:
   - All editable block textareas (`paragraph`, `heading1..3`, `todo`, `callout`, `quote`) enforce `overflow: hidden !important` via both Tailwind utility `overflow-hidden block` and inline style `overflow: 'hidden'`, supplemented by global stylesheet rule `textarea.resize-none { overflow: hidden !important; }` in `src/index.css`.
2. **Synchronous Pre-Paint Sizing (`adjustTextareaHeight`)**:
   - Resizing logic sets `el.style.height = 'auto'`, then `el.style.height = `${el.scrollHeight}px`` and resets `el.scrollTop = 0`.
   - Executed via `useLayoutEffect` on `[block.content, block.type]` prior to DOM painting, eliminating layout shift and frame flicker.
   - Executed synchronously on user input (`handleTextChange`).
3. **Viewport & Container Resize Parity (`ResizeObserver`)**:
   - Subscribes an explicit width-tracking `ResizeObserver` on every editable textarea (`textareaRef.current` and `titleTextareaRef.current`). When `contentRect.width` changes (due to content width toggle, e.g. 50% <-> 100%, sidebar collapse/expand, or window resize), schedules `adjustTextareaHeight()` via `requestAnimationFrame`, eliminating bloated block heights and layout lag without needing a page refresh.
   - Preserves `window.addEventListener('resize', adjustTextareaHeight)` and container `onTransitionEnd` handlers as fallback triggers.
4. **Transition Isolation**:
   - Transitions on block textareas are restricted to color/opacity properties (`transition-colors`), avoiding `transition-all` which animated height and caused transient scrollbars.

### 7.7 Cross-Block Vertical Cursor Navigation with Pixel Coordinate Alignment (`caretCoordinates.ts`)

#### 7.7.1 Architectural Problem & Pixel vs Character Preservation
When vertical cursor keys (`ArrowUp` / `ArrowDown`) navigate between adjacent blocks, maintaining raw character offsets causes extreme visual jumping and cursor drift:
1. **Typography Discrepancy**: A 24px bold title contains far fewer characters per line than a 14px regular paragraph, so character count 10 on a heading is physically much further to the right than character count 10 on a paragraph.
2. **Horizontal Offsets & Margins**: Blocks exhibit different left margins and internal paddings (e.g., to-do items have a +26px checkbox indent, callouts have a +36px icon indent, quotes have a left border and padding).
To achieve natural, straight-line vertical traversal, the navigation subsystem measures and preserves the exact screen horizontal coordinate (`clientX` / `targetClientX`), targeting the visually closest character on the boundary line of the adjacent block.

#### 7.7.2 Textarea Mirror DOM & Binary Search Subsystem (`caretCoordinates.ts`)
HTML `<textarea>` elements do not expose native DOM Range coordinates for arbitrary text offsets:
1. **Offscreen Mirror DOM**: An invisible off-screen mirror element duplicates all 24 CSS text and box model properties (`fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`, `padding`, `border`, `boxSizing`, etc.).
2. **Caret Point Resolution (`getTextareaCaretCoordinates`)**: Appends text up to `charIndex`, inserts a zero-width tracking `<span>`, and extracts the exact subpixel bounding rect, producing `{ left, top, clientX, clientY, lineHeight }`.
3. **Line Boundary Detection**:
   - `isTextareaOnFirstLine`: Evaluates whether the caret's vertical offset relative to the textarea padding top is strictly less than one full line-height (`top < lineHeight * 0.95`).
   - `isTextareaOnLastLine`: Evaluates whether the bottom distance to total scroll height is within one line-height (`scrollHeight - (top + lineHeight) < lineHeight * 0.95`).
4. **Binary Search Coordinate Targeter (`findClosestTextareaIndexForClientX`)**:
   - Finds the line text range `[lineStart, lineEnd]` for the `'first'` or `'last'` visual line.
   - Executes a binary search over character offsets in that range ($\le 7$ iterations, $< 0.05$ms), computing the `clientX` of candidate offsets to pinpoint the character that minimizes $| \text{clientX} - \text{targetClientX} |$.

#### 7.7.3 ContentEditable Inline Component Traversal (`InlineRichEditor.tsx` & `caretCoordinates.ts`)
In rich inline blocks containing embedded graphic badges (`PageLinkBadge`, marked with `contenteditable="false"`):
1. **Caret Extraction (`getContentEditableCaretPoint`)**: Queries `window.getSelection()`. If rect dimensions are 0 (collapsed caret), inserts a temporary zero-width character span `\u200b` to reliably extract the client point coordinates.
2. **Point-to-Caret Projection & Wide-Character Component Resolution (`setContentEditableCaretAtClientX`)**:
   - **Direct Atomic Intersection**: Queries all `[contenteditable="false"]` elements within `container`. If an element intersects the target line and `targetClientX` falls within `[rect.left, rect.right]`, it is treated as a single, wide character. The horizontal midpoint `midX = rect.left + rect.width / 2` determines placement:
     - `targetClientX < midX`: Collapses the caret immediately before the element (`placeCaretBeforeElement`), targeting `(prevSibling, textLength)` if an adjacent text node exists, or `range.setStartBefore(el)`.
     - `targetClientX >= midX`: Collapses the caret immediately after the element (`placeCaretAfterElement`), targeting `(nextSibling, 0)` if an adjacent text node exists, or `range.setStartAfter(el)`.
   - **Resolved Node Protection**: When querying `document.caretPositionFromPoint` or `document.caretRangeFromPoint`, if the returned container is a descendant of or matches `[contenteditable="false"]`, the selection is intercepted and safely projected outside the element based on distance to `midX`, preventing the caret from landing inside non-editable DOM structures and disappearing.
   - **Editable Node Placement**: When the resolved node is a standard text node, collapses the selection at `(targetNode, targetOffset)`.

#### 7.7.4 Orchestration Contract (`App.tsx`, `BlockRenderer.tsx`, `EditorHeader.tsx`)
1. **State Shape (`FocusTarget`)**:
   ```typescript
   interface FocusTarget {
     id: string;
     cursorPosition?: 'start' | 'end' | number;
     targetClientX?: number;
     targetLine?: 'first' | 'last';
   }
   ```
2. **Boundary Dispatch (`handleNavigateCursor`)**:
   - Upward from Block 0: Focuses `note-title` with `targetLine: 'last'` and `targetClientX`.
   - Downward from `note-title`: Focuses Block 0 with `targetLine: 'first'` and `targetClientX`.
   - Non-text blocks (`image`, `file`) are automatically skipped during traversal.
   - Text selection (`selectionStart !== selectionEnd` or `!isCollapsed`) and modifier keys (`Shift`, `Ctrl`, `Alt`, `Cmd`) are not intercepted, preserving native browser selection and hotkey contracts.

### 7.8 Character-Accurate Continuous Cross-Block Text Selection Architecture

#### 7.8.1 Text Block Model Unification
To eliminate shadow DOM selection encapsulation barriers inherent to `<textarea>`, all editable text blocks (paragraphs, hierarchical headings 1–3, to-do checklists, callout alerts, and quotes) are unified on the isolated `InlineRichEditor` component:
1. **DOM Structure**: Real DOM text nodes and inline badge elements (`[data-link-raw]`) inside an editable host div.
2. **WAI-ARIA Accessibility**: Annotated with `role="textbox"`, `aria-multiline="true"`, `aria-label`, `aria-placeholder`, `spellCheck={true}`, and `inputMode="text"`.
3. **In-Page Search & Native Assistive Technology**: By retaining native DOM text nodes, native browser in-page search (`Ctrl+F`) and screen readers index all document content across all blocks seamlessly.

#### 7.8.2 Virtual Selection State Model (`src/lib/crossBlockSelection.ts`)
The multi-block selection subsystem models cross-block ranges as pure data:
```typescript
export interface SelectionPoint {
  blockId: string;
  blockIndex: number;
  offset: number; // Serialized character offset in block.content
  clientX?: number;
}

export interface MultiBlockSelection {
  anchor: SelectionPoint; // Selection origin
  focus: SelectionPoint;  // Active selection extension
}
```

#### 7.8.3 SVG Subpixel Highlight Overlay (`SelectionOverlay.tsx`)
1. **Highlight Computation (`computeMultiBlockSelectionRects`)**:
   - Iterates through selected blocks from `min(anchor, focus)` to `max(anchor, focus)`.
   - Uses `getDomPointFromCharOffset(container, offset)` to resolve serialized character offsets to DOM nodes.
   - Constructs a temporary `Range` over each block's selected sub-slice and queries `range.getClientRects()`.
   - Normalizes client rects relative to the scroll container's scroll origin `(r.left - canvasRect.left + canvasEl.scrollLeft, r.top - canvasRect.top + canvasEl.scrollTop)`.
2. **SVG Rendering**:
   - Renders inside an absolutely positioned SVG overlay (`SelectionOverlay.tsx`) with `pointer-events-none z-10 overflow-visible`.
   - Draws SVG `<rect>` elements styled with `fill="var(--theme-accent)"` and `fillOpacity={0.25}` with subtle border rounding (`rx={2}`).

#### 7.8.4 Drag Selection Pipeline (`App.tsx`)
1. **`onMouseDown`**: On primary click inside `[data-block-id]`, resolves click point to character offset via `document.caretPositionFromPoint` (or `caretRangeFromPoint`) and `getCharOffsetFromDomPoint`, initializing `dragStartPointRef`. Clears any prior `multiBlockSelection`.
2. **`mousemove`**: When dragging across different block elements (`blockIndex !== anchor.blockIndex`), suppresses browser native range highlight (`window.getSelection()?.removeAllRanges()`) and updates `multiBlockSelection` and `selectionRects`.
3. **`mouseup`**: Finalizes drag; retains `multiBlockSelection` active across blocks while suppressing conflicting single-block native focus highlights.

#### 7.8.5 `Shift+Arrow` Keyboard Selection Expansion
1. **Boundary Interception (`InlineRichEditor.tsx`)**:
   - When `Shift+ArrowUp` or `Shift+ArrowLeft` occurs at the block start boundary (or first visual line), or `Shift+ArrowDown` / `Shift+ArrowRight` occurs at the end boundary (or last visual line), dispatches `onShiftBoundary`.
2. **Global Keydown Capture (`App.tsx`)**:
   - When `multiBlockSelection` is active, keyboard navigation hooks intercept `Shift+ArrowUp/Down/Left/Right` in the capture phase, expanding or contracting the `focus` point across block boundaries without disrupting the `anchor` point.

#### 7.8.6 Atomic Multi-Block Operations
1. **Dual-MIME Copy (`Ctrl+C` / `Cmd+C`)**: Extracts the exact concatenated plain text and HTML representation across blocks via `extractMultiBlockText()`, writing to system clipboard via `writeMultiMimeToClipboard()`.
2. **Cut (`Ctrl+X` / `Cmd+X` / `Shift+Delete`)**: Copies selection and executes atomic deletion.
3. **Atomic Deletion & Replacement (`deleteMultiBlockSelection`)**:
   - Slices and concatenates `prefix` (start block content prior to start offset) and `suffix` (end block content after end offset), inserting optional typed character in-between.
   - Updates start block content, deletes all intermediate blocks and end block.
   - Focuses the start block with caret precisely positioned at the merge boundary (`targetOffset`).

---

## 8. Editor Footer Architecture & Viewport Layout Alignment

### 8.1 Layout Contract & Geometry Synchronization
The application enforces a horizontal baseline divider across all columns (`Sidebar` and `Main Content Area`):
1. **Sidebar Navigation Footer (`Sidebar.tsx`)**:
   - Container classes: `h-10 px-3 border-t flex items-center justify-between text-xs shrink-0`.
   - Styles: `borderColor: 'var(--theme-border)'`, `backgroundColor: 'var(--theme-bg-sidebar)'`.
2. **Editor Action Footer (`EditorFooter.tsx`)**:
   - Component: `src/components/EditorFooter.tsx`.
   - Container classes: `h-10 px-4 border-t flex items-center justify-between text-xs shrink-0 z-20 select-none`.
   - Styles: `borderColor: 'var(--theme-border)'`, `backgroundColor: 'var(--theme-bg-sidebar)'`, `color: 'var(--theme-text-main)'`.
   - Height parity: locked to `h-10` (`40px` / `2.5rem`), ensuring that the top border `border-t` of both containers forms an unbroken, pixel-perfect continuous divider across the screen regardless of scroll position.

### 8.2 Component Boundary & State Decoupling
1. **`EditorHeader.tsx` Specification**:
   - Exclusively responsible for document presentation at the top of the scroll container: cover image banner with hover overlay, emoji icon picker, and dynamic auto-resizing title textarea.
   - Props contract: strictly `{ note: Note; onUpdateNote: (fields: Partial<Note>) => void }`.
2. **`EditorFooter.tsx` Specification**:
   - Houses all global and document-level action triggers and metadata indicators at the viewport bottom:
     - **Left Section**: Navigation sidebar toggle button (`Menu`), real-time cloud/local sync status indicator (`Cloud`, `CloudUpload`, `CloudOff`), and active note metadata summary (`· Ultima modifica HH:mm · N blocchi`).
     - **Right Section**: Active note action controls when a note is active (`Star` favorite toggle, `Download` markdown export, and `Trash2` note deletion with confirmation).
   - Props contract: `{ note?: Note | null; syncStatus: SyncStatus; isLoggedIn: boolean; isSidebarOpen: boolean; onToggleSidebar: () => void; onUpdateNote?: (fields: Partial<Note>) => void; onDeleteNote?: (noteId: string) => void }`.
3. **Scroll Isolation in `App.tsx`**:
   - `<main>` container is configured with `flex-1 h-full overflow-hidden flex flex-col relative`.
   - The central document canvas is encapsulated inside `<div className="flex-1 overflow-y-auto flex flex-col relative">`, providing smooth vertical scrolling for document contents while the `EditorFooter` remains steadily pinned to the viewport baseline.

### 8.3 Sidebar Memory Footprint Polling Specification (`Sidebar.tsx`)
1. **Dynamic State Management**:
   - Replaced static `useMemo` evaluation with `useState` initialized via `getFullTabMemoryFootprint(notes, workspaceStatus)`.
2. **Periodic Polling Contract (`useEffect`)**:
   - Executes an immediate footprint calculation upon `[notes, workspaceStatus]` mutation.
   - Registers a 3000ms recurring timer (`setInterval`) to sample real-time `performance.memory` fluctuations, dynamic heap allocations, and Garbage Collection sweeps.
   - Implements background tab throttling: halts execution when `document.hidden === true` to conserve CPU cycles.
   - Enforces React rendering bailout: compares `prev` vs `next` formatted representations (`formattedTotalRecoverable`, `formattedJsHeapUsed`, `formattedDecodedBitmaps`, `formattedWorkspaceData`); if strings are identical, returns `prev` unchanged, preventing unnecessary React component re-renders.

### 8.4 Content Area Width Expansion Specification (`ContentWidthDropdown.tsx` & `contentWidth.ts`)

#### 8.4.1 Configuration Matrix & Default Model
The content width subsystem (`src/lib/contentWidth.ts`) standardizes a two-tier configuration model:
1. **Inherited Option ("Default")**:
   - Represents `contentWidth: 'default'` (or `undefined`). Dynamically resolves to whatever concrete width is currently configured as the user's global default.
2. **Concrete Width Values**:
   - `Fixed 44em`: Expressed in CSS em units: `44em` (704px on standard 16px user-agent baseline). Enforces `maxWidth: '44em'`. The resolution subsystem retains backward compatibility mapping legacy `'700px'` settings to `'44em'`.
   - `50%`: Half of available viewport width: `maxWidth: '50%'`.
   - `75%`: Three-quarters of available width: `maxWidth: '75%'`.
   - `95%`: Near full width: `maxWidth: '95%'`.
   - `100%`: Full width: `maxWidth: '100%'`.
3. **Fallback Baseline**:
   - In the absence of user customization, the fallback baseline default of the default is strictly `Fixed 44em` (`44em`).

#### 8.4.2 UI Component Contract & Interaction Gestures (`ContentWidthDropdown.tsx`)
- **Placement**: Nested inside `EditorFooter.tsx` right action container, immediately before the favorite button (`Star`).
- **Trigger**: Displays `UnfoldHorizontal` icon alongside the current width string (e.g. `Def (44em)` when inheriting default, or `75%` when customized) with descriptive tooltip.
- **Normal Click**: Applies the clicked option specifically to the active document's metadata (`Note.contentWidth`), closing the dropdown popover.
- **Ctrl+Click / Cmd+Click Default Gesture**:
  - Actuating `Ctrl+Click` (or `Cmd+Click`) on any of the five concrete values sets that value as the new global default (`setDefaultContentWidth`), without modifying custom overrides on other documents.
  - Documents configured with `Default` immediately and reactively re-render to the new default width.
  - The dropdown visually highlights the active global default using an amber `Default` badge, and marks the active page selection with a green checkmark.
- **Popover Geometry**: Opens upward (`bottom-full mb-1.5 right-0`) with subtle backdrop shadow, preventing overflow clipping below the bottom viewport boundary.
- **Accessibility & Dismissal**: Listens for click-outside and `Escape` keyboard shortcuts.

#### 8.4.3 Synchronized Layout & Dynamic Auto-Resizing
1. **Container Synchronization**:
   - `EditorHeader.tsx` title/icon container (`style={{ maxWidth: getContentWidthCss(note.contentWidth, defaultContentWidth) }}`).
   - `App.tsx` block canvas container (`style={{ maxWidth: getContentWidthCss(activeNote.contentWidth, defaultContentWidth) }}`).
   - Both elements share `w-full mx-auto px-12 transition-[max-width] duration-150`, keeping them horizontally aligned during width transitions.
2. **Textarea Height Recalculation & Reactive Layout Tracking**:
   - Upon selecting a new width or updating the global default, `ContentWidthDropdown` dispatches synthetic resize events immediately, on subsequent animation frames, and post-transition.
   - All editable block textareas (`BlockRenderer.tsx`) and header titles (`EditorHeader.tsx`) track their rendered widths via native `ResizeObserver` instances. Whenever the horizontal width changes (such as expanding from 50% to 100%), heights are dynamically and synchronously recomputed via `adjustTextareaHeight()` on animation frames, preventing height inflation and layout clipping without requiring a manual page refresh.
   - Container elements (`App.tsx` canvas container and `EditorHeader.tsx`) bind `onTransitionEnd` to trigger window-level resize events when `max-width` transitions conclude.
3. **Persistence Contract**:
   - Per-page selection is persisted in document metadata (`Note.contentWidth`) across local partition storage (`liteblocks_ws_<wsId>_notes`) and cloud Firestore synchronization.
   - Workspace default selection is persisted in workspace metadata (`WorkspaceMeta.defaultContentWidth`) within the workspace manifest (`liteblocks_workspaces_manifest_v1`), strictly adhering to workspace multi-context isolation (FR-1).
   - Newly created documents are initialized with `contentWidth: 'default'`, seamlessly inheriting their workspace's default setting.

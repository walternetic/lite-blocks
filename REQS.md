# Requirements Document (REQS.md) — Lite Blocks

## 1. Vision & Problem Statement

Lite Blocks is a lightweight, local-first multimedia workspace for documents, modular blocks, and structured knowledge. Traditional cloud workspace applications often suffer from high memory footprints, noticeable typing latency, network dependency, and opaque release cycles. Conversely, traditional local plain-text editors lack rich interactive media blocks and cross-device synchronization.

Lite Blocks resolves this dichotomy by providing:
1. Complete local-first responsiveness with immediate data persistence.
2. Structured modular document composition with zero loss of formatting fidelity.
3. Ergonomic multi-workspace isolation with dynamic memory reclamation.
4. Accessible, high-contrast theming conforming to accessibility baselines.
5. Automated release auditing and semantic version governance.

---

## 2. Functional Requirements (FR)

### FR-1: Workspace Management & Multi-Context Isolation
- **FR-1.1**: The system shall support multiple distinct workspaces, allowing complete separation of documents, configuration, and visual themes.
- **FR-1.2**: The system shall allow users to navigate between workspaces in-place or spawn a workspace into an independent browser tab without race conditions.
- **FR-1.3**: The system shall provide an explicit hibernation/unloading mechanism for inactive workspaces, purging volatile memory structures while preserving persistent state on disk.
- **FR-1.4**: Workspaces shall retain custom visual identifiers including symbolic icons and human-readable names.

### FR-2: Document & Block Authoring
- **FR-2.1**: Documents shall be authored using structured, reorderable blocks (including paragraphs, hierarchical headings, checklists, syntax-highlighted code, callout alerts, and embedded media).
- **FR-2.2**: The system shall guarantee immediate persistence of all modifications without requiring explicit user save actions.
- **FR-2.3**: The system shall provide rapid document filtering, favorites classification, and full-text keyword retrieval across all loaded workspaces.
- **FR-2.4**: When the user presses the Enter key within an active text block without modifiers, the system shall insert a new block directly below the active block and immediately transfer the keyboard focus and cursor into the newly created block.
- **FR-2.5**: If the Enter key is actuated while the cursor is positioned within existing text, the system shall split the content: text preceding the cursor shall remain in the active block, text following the cursor shall populate the new block, and the cursor shall be placed at the start of the new block.
- **FR-2.6**: When the user actuates the Backspace key while the cursor is positioned at the start of a block (character offset 0 with no text selected) and a preceding text-compatible block exists, the system shall merge the content—and strictly only the content—of the active block into the preceding block, immediately delete the active block, and position the cursor at the boundary where the two contents joined.
- **FR-2.7**: When the user actuates the Delete key while the cursor is positioned at the end of a block with no text selected and a subsequent text-compatible block exists, the system shall merge the content—and strictly only the content—of the subsequent block into the active block, immediately delete the subsequent block, and maintain the cursor at the boundary where the two contents joined.
- **FR-2.8**: Page links shall be presented as horizontal inline graphic components integrated seamlessly into the paragraph text flow alongside adjacent words, rather than as vertical detached blocks, and shall be displayed exclusively in their rendered visual representation.
- **FR-2.9**: Actuating an inline page link via standard left-click shall open the target page in a separate browser context. Actuating via right-click or Shift+click shall expose a compact editor modal allowing the user to modify the destination address and display title, or remove the link.
- **FR-2.10**: When the user closes an inline page link tag (e.g., typing `]]` after `[[Workspace]]`), the system shall not automatically or silently bind an arbitrary document. Instead, closing the tag shall immediately open the page link editor modal prefilled with the typed target, enabling explicit user selection.
- **FR-2.11**: The page link editor modal shall provide autocompletion combobox interfaces with real-time incremental filtering for workspace selection and page/note selection, replacing static select drop-downs.
- **FR-2.12**: Inline page link components shall be selectable as text within the editor content flow, enabling continuous mouse or keyboard selection across surrounding words, and shall reflect visual selection highlighting matching surrounding text selection.
- **FR-2.13**: When copying selected content across any block or component, the system shall simultaneously populate the clipboard with both a plain text representation (`text/plain` using wikilink markup) and a rich HTML representation (`text/html` using semantic hyperlinks with metadata attributes).
- **FR-2.14**: When pasting content across any block or component:
  - If plain text paste is triggered (such as via `Ctrl+Shift+V` or when only `text/plain` is available), the system shall force the insertion of the clipboard content as literal plain text without conversions or link interpretations.
  - If standard paste is triggered (`Ctrl+V`) and the clipboard contains `text/html` with one or more hyperlinks, the system shall convert the links into native inline page link components within the document flow.
- **FR-2.15**: The system shall maintain an application-local clipboard operating in parallel with the host operating system clipboard:
  - Copying blocks or content shall simultaneously populate both the host system clipboard and the application-local clipboard. When copying an entire block (via the block handle "Copia" or dedicated block copy triggers), the application-local clipboard shall preserve the full structural block definition (including block type, content, language for code snippets, completion status for checklist items, and metadata).
  - The block gutter handle menu shall provide an "Incolla sotto" action and a "Sostituisci con clipboard" action (within the "Altre.." flyout submenu) that draw exclusively from the application-local clipboard:
    - "Incolla sotto" shall instantiate and insert a new block structurally identical to the copied block (retaining the exact block type, language, content, and metadata, with an algorithmic unique identifier) directly below the active block.
    - "Sostituisci con clipboard" shall replace the active block, transforming it into the identical block type and metadata of the copied block while maintaining the current block's identifier.
  - The "Incolla sotto" and "Sostituisci con clipboard" actions shall be enabled strictly and only when valid content exists in the application-local clipboard, and shall remain disabled with distinct visual affordance when the local clipboard is empty.
- **FR-2.16**: Gutter handle menus and nested flyout submenus shall guarantee stable hover and traversal ergonomics, and shall dynamically invert or constrain their spatial coordinates to prevent clipping or rendering beyond the active viewport boundaries:
  - Contextual flyout submenus shall remain continuously open across physical spatial gaps and diagonal cursor trajectories between the trigger and the submenu card.
  - Submenu dismissal upon pointer exit shall incorporate a temporal grace period to prevent accidental collapse during transit.
  - The block handle options menu shall remain anchored and open independently of row cursor hover, dismissing exclusively upon external clicks, hotkeys, or explicit user action selection.
  - Both main options menu and contextual flyout submenus shall dynamically invert their spatial layout (opening upward or leftward) when available viewport margin is insufficient, and clamp their maximum dimensions within the viewport.
  - The main options menu shall expose a prominent "Elimina" deletion action with clear keyboard shortcut affordance.
- **FR-2.17**: When the user actuates the `Alt+Delete` keyboard shortcut within an active block, the system shall immediately remove the current block from the document, preserving standard host operating system clipboard cut behaviors on text selections (`Shift+Delete` / `WM_CUT`), and transfer keyboard focus to the preceding block at its end boundary (or to the subsequent block if the deleted block was the first in the document, or to a freshly initialized empty paragraph block if no blocks remain).
- **FR-2.18**: The system shall support the standard CUA/Windows `Shift+Delete` and `Ctrl+X` (`WM_CUT`) shortcut across all blocks and editors: when text or inline components are selected, actuating `Shift+Delete` or `Ctrl+X` shall cut the selected content, simultaneously writing it to both the dual-MIME system clipboard (`text/plain` and `text/html`) and the application-local clipboard, and removing the selection from the active block. When no content is selected, `Shift+Delete` shall not alter the document or delete the block.
- **FR-2.19**: The primary application action bar (housing navigation sidebar toggling, background sync state monitoring, active document metadata summary, document favorite toggling, markdown export, and document deletion) shall be anchored permanently at the bottom of the main content viewport as a dedicated footer (`EditorFooter`). The editor footer shall display document metadata (last modification timestamp and block count) adjacent to the sync status, freeing the document header from metadata clutter, and shall be graphically, dimensionally, and chromatically aligned with the sidebar navigation footer (sharing identical vertical height, border treatment, and theme palette variables) to produce an unbroken, seamless horizontal baseline across the entire viewport, while the document title, cover, and block canvas scroll independently within the main content container.
- **FR-2.20**: Editable text blocks (including paragraphs, hierarchical headings, to-do items, callouts, and quotes) shall dynamically auto-expand their vertical height to fully accommodate multi-line content without exhibiting internal vertical or horizontal scrollbars. Auto-resizing shall execute synchronously pre-paint on keystrokes and adapt responsively to viewport or sidebar resizing, ensuring that content scrolling remains strictly confined to the document's main viewport container.
- **FR-2.21**: The system shall provide an option in the document action footer (located in the right action group immediately preceding the favorite toggle control) to expand the page content area to a user-selectable proportion of available horizontal space. The configuration options shall include "Default" (inheriting the active workspace's default width) and five concrete values: Fixed 44em (calculated in em units with an effective measure of 44em), 50%, 75%, 95%, and 100% full width. Conforming strictly to the workspace isolation principle (FR-1), the default width setting shall be partitioned independently per workspace (`WorkspaceMeta.defaultContentWidth`). The workspace default width shall be configurable by performing a `Ctrl+Click` (or `Cmd+Click`) on any of the concrete options, with the universal fallback default across workspaces specified as Fixed 44em. The content width shall persist per page within the document metadata (`Note.contentWidth`). The selected width shall synchronously constrain both the document header title area and the block canvas container, and trigger synchronous height recalculation across all auto-resizing text blocks.
- **FR-2.22**: The system shall support seamless vertical cursor navigation across document blocks and the document header title using the `ArrowUp` and `ArrowDown` cursor keys:
  - When the cursor is on the first visual line of a block (or at offset 0) and the user presses `ArrowUp` without modifiers, the system shall transition keyboard focus to the preceding text block (or the document title if ascending from the first block), automatically skipping non-text blocks (such as images and files).
  - When the cursor is on the last visual line of a block (or at the end of the text) and the user presses `ArrowDown` without modifiers, the system shall transition keyboard focus to the subsequent text block, automatically skipping non-text blocks.
  - When transitioning between blocks or to/from the document title, the system shall maintain the horizontal pixel distance from the left margin (`targetClientX`), ensuring that the cursor lands on the closest corresponding character offset on the target line, regardless of differing font sizes (e.g. 14px body vs 24px heading vs 36px title), block type indentations (e.g. to-do checkboxes, callouts, blockquotes), or inline components (e.g. wikilink badges).
  - Atomic inline components (`contenteditable="false"`, including page link badges) shall be treated as single, wide characters during vertical navigation: when the target coordinate intersects an atomic component on the target line, the caret shall land immediately before or after the component based on horizontal distance from its midpoint, preventing the caret from landing inside non-editable elements or disappearing.
  - If text is currently selected or modifier keys (`Shift`, `Alt`, `Ctrl`, `Cmd`) are pressed, cursor keys shall preserve native browser text selection and modifier behaviors without interception.
- **FR-2.23**: The system shall support character-accurate continuous cross-block text selection spanning across arbitrary blocks and character offsets:
  - Text blocks (paragraphs, hierarchical headings, to-do checklists, callout notes, and quotes) shall be rendered uniformly with isolated DOM text editing containers (`InlineRichEditor`) annotated with WAI-ARIA editing semantics (`role="textbox"`, `aria-multiline="true"`).
  - Users shall be able to initiate a continuous selection from an arbitrary character in any block and drag across block boundaries to an arbitrary character in any subsequent or preceding block via mouse drag or keyboard navigation (`Shift+Arrow` keys).
  - Active cross-block selection highlights shall be rendered through an SVG overlay layer drawing subpixel highlight rectangles derived from native `Range.getClientRects()`.
  - When text is selected across blocks, actuating clipboard copy (`Ctrl+C` / `Cmd+C`) or cut (`Ctrl+X` / `Cmd+X` / `Shift+Delete`) shall populate the system dual-MIME clipboard with the exact selected text slice. Actuating deletion (`Backspace` / `Delete`) or typing a printable replacement character shall perform an atomic state mutation that merges the unselected prefix of the starting block with the unselected suffix of the ending block, and removes intermediate blocks.

### FR-3: Theming & Visual Ergonomics
- **FR-3.1**: The system shall provide a curated palette of visual themes covering both low-luminance (dark) and high-luminance (light) environments.
- **FR-3.2**: All themes shall satisfy the WCAG AA accessibility specification, guaranteeing a minimum contrast ratio of 4.5:1 for body and interface text against surrounding backgrounds.
- **FR-3.3**: The system shall apply theme selections immediately across all user interface surfaces, including document navigation panels, headers, workspaces, and block renderers.
- **FR-3.4**: The system shall persist the chosen theme independently per workspace.

### FR-4: Version Management & Release Governance
- **FR-4.1**: The system shall track and manage its release progression according to the Semantic Versioning specification (SemVer 2.0.0: `MAJOR.MINOR.PATCH`).
- **FR-4.2**: The system shall automatically evaluate codebase changes and increment version identifiers upon commit or release execution:
  - Backward-compatible defect resolutions and internal refactorings shall increment the `PATCH` component.
  - Backward-compatible feature additions shall increment the `MINOR` component and reset `PATCH` to zero.
  - Incompatible breaking changes shall increment the `MAJOR` component and reset `MINOR` and `PATCH` to zero.
- **FR-4.3**: The system shall expose the active version identifier conspicuously within the user interface for auditing and verification.

---

## 3. Non-Functional Requirements (NFR)

### NFR-1: Performance & Interaction Latency
- The system shall execute local document queries and search filtering within 16 milliseconds.
- User input into editor blocks shall register without perceptual latency (< 8 milliseconds processing overhead).

### NFR-2: Memory & Environmental Efficiency
- The system shall provide real-time diagnostics of client resource consumption and memory footprint, including periodic background polling (every 3 seconds) of the active tab footprint in the navigation sidebar footer to reflect dynamic V8 heap allocations and garbage collection cycles.
- Evicting dormant workspaces shall measurably reduce active runtime memory consumption.

### NFR-3: Zero Dependency Proliferation
- Versioning and automation mechanisms shall rely strictly on built-in standard platform tooling, avoiding external runtime or development dependencies.

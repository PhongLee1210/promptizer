import type { PackSummary, Prompt } from "@promptizer/shared";
import { createLibraryCache } from "../library/library-cache";
import { createBrowserSnapshotStore } from "../library/snapshot-store";
import { PICKER_HEIGHT } from "./anchor";
import { button } from "./result-window";

export interface PickerLibrary {
  prompts: Prompt[];
  packs: PackSummary[];
}

export interface PromptPickerCallbacks {
  onPick: (prompt: Prompt) => void;
  onOpenDashboard: () => void;
  onClose: () => void;
}

type PickerRow = { kind: "pack"; pack: PackSummary } | { kind: "prompt"; prompt: Prompt };

const LIST_ID = "pz-picker-list";
const ROW_ID_PREFIX = "pz-picker-row-";
const PICKER_TITLE = "My Prompts";
const OFFLINE_MESSAGE = "You're offline. Showing your last synced library.";
const EMPTY_LIBRARY_MESSAGE = "No saved prompts yet. Add some on the dashboard, then sync from the Promptizer popup.";

export const PICKER_STYLE = `
  .pz-picker {
    height: ${PICKER_HEIGHT}px;
  }
  .pz-picker__search {
    flex: none;
    padding: 6px 8px;
    border-bottom: 1px solid var(--pz-color-border-base-muted);
  }
  input.pz-picker__input {
    box-sizing: border-box;
    width: 100%;
    height: 26px;
    padding: 0 8px;
    border-radius: 7px;
    border: 1px solid var(--pz-color-border-base-muted);
    background: var(--pz-color-background-base-raised);
    color: inherit;
    font: inherit;
    font-size: 12px;
    outline: 0;
  }
  input.pz-picker__input:focus-visible {
    border-color: var(--pz-color-fill-brand-default);
  }
  .pz-picker__offline {
    flex: none;
    margin: 0;
    padding: 4px 10px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--pz-color-text-base-subdued);
    border-bottom: 1px solid var(--pz-color-border-base-muted);
  }
  .pz-picker__offline[hidden] {
    display: none;
  }
  .pz-picker__list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--pz-color-fill-track-default) transparent;
  }
  .pz-picker__row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 7px;
    font-size: 12px;
    cursor: pointer;
  }
  .pz-picker__row[aria-selected="true"] {
    background: var(--pz-color-fill-selected-default);
  }
  .pz-picker__label {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pz-picker__meta {
    flex: none;
    font-size: 11px;
    color: var(--pz-color-text-base-subdued);
  }
  .pz-picker__row[data-kind="pack"] .pz-picker__label {
    font-weight: 600;
  }
  .pz-picker__note {
    margin: 0;
    padding: 10px 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--pz-color-text-base-subdued);
  }
  .pz-picker__note button {
    margin-top: 8px;
  }
  @media (hover: hover) and (pointer: fine) {
    .pz-picker__row:hover {
      background: var(--pz-color-fill-hover-default);
    }
  }
`;

async function readCachedLibrary(): Promise<PickerLibrary> {
  const cached = await createLibraryCache(createBrowserSnapshotStore()).read();
  return { prompts: cached.prompts, packs: cached.packs };
}

function byTitle(left: Prompt, right: Prompt): number {
  return left.title.localeCompare(right.title);
}

function matchesQuery(prompt: Prompt, query: string): boolean {
  return prompt.title.toLocaleLowerCase().includes(query);
}

export class PromptPicker {
  private readonly element: HTMLDivElement;
  private readonly topBar: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLDivElement;
  private readonly offlineNote: HTMLParagraphElement;
  private library: PickerLibrary = { prompts: [], packs: [] };
  private openPack: PackSummary | null = null;
  private rows: PickerRow[] = [];
  private activeIndex = 0;
  private isOpen = false;
  private openCount = 0;

  constructor(
    private readonly callbacks: PromptPickerCallbacks,
    private readonly loadLibrary: () => Promise<PickerLibrary> = readCachedLibrary,
  ) {
    this.element = document.createElement("div");
    this.element.className = "pz-win pz-picker";
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-label", PICKER_TITLE);
    this.element.dataset.open = "false";

    this.topBar = document.createElement("div");
    this.topBar.className = "pz-win__bar pz-win__bar--top";

    const search = document.createElement("div");
    search.className = "pz-picker__search";
    this.input = document.createElement("input");
    this.input.type = "search";
    this.input.className = "pz-picker__input";
    this.input.placeholder = "Search by title";
    this.input.setAttribute("aria-label", "Search prompts");
    this.input.setAttribute("role", "combobox");
    this.input.setAttribute("aria-expanded", "true");
    this.input.setAttribute("aria-controls", LIST_ID);
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.input.addEventListener("input", () => {
      this.activeIndex = 0;
      this.renderContent();
    });
    this.input.addEventListener("keydown", (event) => this.handleKey(event));
    search.append(this.input);

    this.list = document.createElement("div");
    this.list.className = "pz-picker__list";
    this.list.id = LIST_ID;
    this.list.setAttribute("role", "listbox");
    this.list.setAttribute("aria-label", PICKER_TITLE);

    this.offlineNote = document.createElement("p");
    this.offlineNote.className = "pz-picker__offline";
    this.offlineNote.setAttribute("role", "status");
    this.offlineNote.textContent = OFFLINE_MESSAGE;
    this.syncOfflineNote();
    window.addEventListener("online", () => this.syncOfflineNote());
    window.addEventListener("offline", () => this.syncOfflineNote());

    this.element.append(this.topBar, search, this.offlineNote, this.list);
  }

  private syncOfflineNote(): void {
    this.offlineNote.hidden = navigator.onLine;
  }

  node(): HTMLDivElement {
    return this.element;
  }

  render(open: boolean): void {
    if (open === this.isOpen) {
      return;
    }
    this.isOpen = open;
    this.element.dataset.open = String(open);
    if (!open) {
      return;
    }
    this.syncOfflineNote();
    const thisOpening = ++this.openCount;
    this.openPack = null;
    this.input.value = "";
    this.activeIndex = 0;
    this.library = { prompts: [], packs: [] };
    this.renderContent();
    void this.loadLibrary().then((library) => {
      if (thisOpening !== this.openCount || !this.isOpen) {
        return;
      }
      this.library = library;
      this.renderContent();
    });
  }

  focusSearch(): void {
    this.input.focus();
  }

  handleEscape(): boolean {
    if (this.openPack === null) {
      return false;
    }
    this.leavePack();
    return true;
  }

  private leavePack(): void {
    this.openPack = null;
    this.input.value = "";
    this.activeIndex = 0;
    this.renderContent();
    this.input.focus();
  }

  private enterPack(pack: PackSummary): void {
    this.openPack = pack;
    this.input.value = "";
    this.activeIndex = 0;
    this.renderContent();
    this.input.focus();
  }

  private visibleRows(): PickerRow[] {
    const query = this.input.value.trim().toLocaleLowerCase();
    const pack = this.openPack;
    const prompts = this.library.prompts
      .filter((prompt) => pack === null || prompt.category?.id === pack.id)
      .filter((prompt) => query.length === 0 || matchesQuery(prompt, query))
      .sort(byTitle)
      .map((prompt): PickerRow => ({ kind: "prompt", prompt }));
    if (pack !== null || query.length > 0) {
      return prompts;
    }
    const packs = [...this.library.packs]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((packSummary): PickerRow => ({ kind: "pack", pack: packSummary }));
    return [...packs, ...prompts];
  }

  private renderContent(): void {
    this.renderTopBar();
    this.rows = this.visibleRows();
    this.activeIndex = Math.min(this.activeIndex, Math.max(this.rows.length - 1, 0));
    this.list.replaceChildren();
    if (this.library.prompts.length === 0 && this.library.packs.length === 0) {
      this.renderNote(EMPTY_LIBRARY_MESSAGE, true);
      return;
    }
    if (this.rows.length === 0) {
      const query = this.input.value.trim();
      this.renderNote(query.length > 0 ? `No prompts match "${query}".` : "This pack has no prompts yet.", false);
      return;
    }
    this.rows.forEach((row, index) => this.list.append(this.createRow(row, index)));
    this.syncActiveRow();
  }

  private renderTopBar(): void {
    const leading = document.createElement("span");
    leading.className = "pz-win__leading";
    if (this.openPack !== null) {
      leading.append(button("back", null, "All packs", () => this.leavePack(), "nav"));
    }
    const title = document.createElement("span");
    title.className = "pz-win__title";
    title.textContent = this.openPack?.name ?? PICKER_TITLE;
    const trailing = document.createElement("span");
    trailing.className = "pz-win__trailing";
    trailing.append(button("close", null, "Close", this.callbacks.onClose, "muted"));
    this.topBar.replaceChildren(leading, title, trailing);
  }

  private renderNote(message: string, withDashboardLink: boolean): void {
    this.input.removeAttribute("aria-activedescendant");
    const note = document.createElement("div");
    note.className = "pz-picker__note";
    note.setAttribute("role", "status");
    note.append(message);
    if (withDashboardLink) {
      const link = button(null, "Open dashboard", "Open dashboard", this.callbacks.onOpenDashboard);
      link.style.width = "auto";
      link.style.padding = "0 8px";
      note.append(document.createElement("br"), link);
    }
    this.list.append(note);
  }

  private createRow(row: PickerRow, index: number): HTMLDivElement {
    const element = document.createElement("div");
    element.className = "pz-picker__row";
    element.id = `${ROW_ID_PREFIX}${index}`;
    element.dataset.kind = row.kind;
    element.setAttribute("role", "option");
    const label = document.createElement("span");
    label.className = "pz-picker__label";
    const meta = document.createElement("span");
    meta.className = "pz-picker__meta";
    if (row.kind === "pack") {
      label.textContent = row.pack.name;
      meta.textContent = String(row.pack.promptCount);
      element.setAttribute(
        "aria-label",
        `${row.pack.name} pack, ${row.pack.promptCount} ${row.pack.promptCount === 1 ? "prompt" : "prompts"}`,
      );
    } else {
      label.textContent = row.prompt.title;
      meta.textContent = this.openPack === null ? (row.prompt.category?.name ?? "") : "";
      element.setAttribute("aria-label", row.prompt.title);
    }
    element.append(label, meta);
    element.addEventListener("mousedown", (event) => event.preventDefault());
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      this.activate(row);
    });
    return element;
  }

  private activate(row: PickerRow): void {
    if (row.kind === "pack") {
      this.enterPack(row.pack);
      return;
    }
    this.callbacks.onPick(row.prompt);
  }

  private syncActiveRow(): void {
    const rowElements = this.list.querySelectorAll<HTMLElement>('[role="option"]');
    rowElements.forEach((element, index) => element.setAttribute("aria-selected", String(index === this.activeIndex)));
    const active = rowElements[this.activeIndex];
    if (active === undefined) {
      this.input.removeAttribute("aria-activedescendant");
      return;
    }
    this.input.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      const row = this.rows[this.activeIndex];
      if (row !== undefined) {
        event.preventDefault();
        this.activate(row);
      }
      return;
    }
    const count = this.rows.length;
    if (count === 0) {
      return;
    }
    const caretKeysBelongToQuery = this.input.value.length > 0;
    const nextIndex: Record<string, number | undefined> = {
      ArrowDown: (this.activeIndex + 1) % count,
      ArrowUp: (this.activeIndex - 1 + count) % count,
      Home: caretKeysBelongToQuery ? undefined : 0,
      End: caretKeysBelongToQuery ? undefined : count - 1,
    };
    const target = nextIndex[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    this.activeIndex = target;
    this.syncActiveRow();
  }
}

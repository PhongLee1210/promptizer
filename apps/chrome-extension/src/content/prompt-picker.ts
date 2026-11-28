import type { PackSummary, Prompt } from "@promptizer/shared";
import { createLibraryCache, withoutPrompt } from "../library/library-cache";
import { createBrowserSnapshotStore } from "../library/snapshot-store";
import type { PromptDeleteResponse, PromptEdit, PromptWriteResponse } from "../prompts/save-prompt-message";
import { PICKER_HEIGHT } from "./anchor";
import { OFFLINE_SAVE_MESSAGE } from "./present-result";
import { button } from "./result-window";

export interface PickerLibrary {
  prompts: Prompt[];
  packs: PackSummary[];
}

export interface PromptPickerCallbacks {
  onPick: (prompt: Prompt) => void;
  onOpenDashboard: () => void;
  onClose: () => void;
  onSaveEdit: (id: string, changes: PromptEdit) => Promise<PromptWriteResponse>;
  onDelete: (id: string) => Promise<PromptDeleteResponse>;
}

type PickerRow = { kind: "pack"; pack: PackSummary } | { kind: "prompt"; prompt: Prompt };

type PickerMode =
  | { kind: "browsing" }
  | { kind: "editing"; prompt: Prompt; isSaving: boolean }
  | { kind: "confirming-delete"; prompt: Prompt; isDeleting: boolean };

const LIST_ID = "pz-picker-list";
const ROW_ID_PREFIX = "pz-picker-row-";
const PICKER_TITLE = "My Prompts";
const OFFLINE_MESSAGE = "You're offline. Showing your last synced library.";
const EMPTY_LIBRARY_MESSAGE = "No saved prompts yet. Add some on the dashboard, then sync from the Promptizer popup.";
const TITLE_ERROR_ID = "pz-picker-title-error";
const TEXT_ERROR_ID = "pz-picker-text-error";
const DELETE_QUESTION_ID = "pz-picker-delete-question";
const DELETE_WARNING = "This permanently deletes the prompt and its text. This can't be undone.";

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
  .pz-picker__row button.pz-picker__row-action {
    display: none;
    flex: none;
  }
  .pz-picker__row[aria-selected="true"] button.pz-picker__row-action {
    display: flex;
  }
  .pz-picker__panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
  }
  .pz-picker__panel[hidden] {
    display: none;
  }
  textarea.pz-picker__text {
    flex: 1;
    min-height: 0;
    height: auto;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--pz-color-border-base-muted);
    font-size: 12px;
  }
  textarea.pz-picker__text:focus-visible {
    border-color: var(--pz-color-fill-brand-default);
  }
  .pz-picker__panel [aria-invalid="true"] {
    border-color: var(--pz-color-text-critical-default);
  }
  .pz-picker__message {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--pz-color-text-base-subdued);
    overflow-wrap: anywhere;
  }
  .pz-picker__message:empty,
  .pz-picker__message[hidden] {
    display: none;
  }
  .pz-picker__message--error {
    color: var(--pz-color-text-critical-default);
  }
  .pz-picker__question {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .pz-picker button.pz-win__btn--critical {
    background: var(--pz-color-text-critical-default);
  }
  @media (hover: hover) and (pointer: fine) {
    .pz-picker__row:hover {
      background: var(--pz-color-fill-hover-default);
    }
    .pz-picker__row:hover button.pz-picker__row-action {
      display: flex;
    }
    .pz-picker button.pz-win__btn--critical:hover {
      background: var(--pz-color-text-critical-default);
      opacity: 0.9;
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

function changedFields(prompt: Prompt, title: string, text: string): PromptEdit {
  return {
    ...(title !== prompt.title ? { title } : {}),
    ...(text !== prompt.text ? { text } : {}),
  };
}

function panelMessage(id: string | null, isError: boolean): HTMLParagraphElement {
  const message = document.createElement("p");
  message.className = `pz-picker__message${isError ? " pz-picker__message--error" : ""}`;
  if (id !== null) {
    message.id = id;
  }
  return message;
}

function offlineWriteNote(): HTMLParagraphElement {
  const note = panelMessage(null, false);
  note.setAttribute("role", "status");
  note.textContent = OFFLINE_SAVE_MESSAGE;
  return note;
}

function showFieldError(field: HTMLInputElement | HTMLTextAreaElement, errorLine: HTMLElement, message?: string): void {
  errorLine.textContent = message ?? "";
  if (message === undefined) {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    return;
  }
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", errorLine.id);
}

export class PromptPicker {
  private readonly element: HTMLDivElement;
  private readonly topBar: HTMLDivElement;
  private readonly search: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLDivElement;
  private readonly offlineNote: HTMLParagraphElement;
  private readonly panel: HTMLDivElement;
  private readonly bottomBar: HTMLDivElement;
  private library: PickerLibrary = { prompts: [], packs: [] };
  private openPack: PackSummary | null = null;
  private mode: PickerMode = { kind: "browsing" };
  private rows: PickerRow[] = [];
  private activeIndex = 0;
  private isOpen = false;
  private openCount = 0;
  private applyPanelAvailability: ((online: boolean) => void) | null = null;

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

    this.search = document.createElement("div");
    this.search.className = "pz-picker__search";
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
    this.search.append(this.input);

    this.list = document.createElement("div");
    this.list.className = "pz-picker__list";
    this.list.id = LIST_ID;
    this.list.setAttribute("role", "listbox");
    this.list.setAttribute("aria-label", PICKER_TITLE);

    this.offlineNote = document.createElement("p");
    this.offlineNote.className = "pz-picker__offline";
    this.offlineNote.setAttribute("role", "status");
    this.offlineNote.textContent = OFFLINE_MESSAGE;

    this.panel = document.createElement("div");
    this.panel.className = "pz-picker__panel";
    this.panel.hidden = true;

    this.bottomBar = document.createElement("div");
    this.bottomBar.className = "pz-win__bar pz-win__bar--bottom";

    this.syncConnectivity();
    window.addEventListener("online", () => this.syncConnectivity());
    window.addEventListener("offline", () => this.syncConnectivity());

    this.element.append(this.topBar, this.search, this.offlineNote, this.list, this.panel, this.bottomBar);
  }

  private syncConnectivity(): void {
    this.offlineNote.hidden = navigator.onLine || this.mode.kind !== "browsing";
    if (this.mode.kind === "browsing") {
      this.syncRowActions();
      return;
    }
    this.applyPanelAvailability?.(navigator.onLine);
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
    const thisOpening = ++this.openCount;
    this.mode = { kind: "browsing" };
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
      if (this.mode.kind === "browsing") {
        this.renderContent();
      }
    });
  }

  focusSearch(): void {
    this.input.focus();
  }

  handleEscape(): boolean {
    if (this.mode.kind === "editing" || this.mode.kind === "confirming-delete") {
      const isBusy = this.mode.kind === "editing" ? this.mode.isSaving : this.mode.isDeleting;
      if (!isBusy) {
        this.returnToList(this.mode.prompt.id);
      }
      return true;
    }
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

  private showBrowsing(isBrowsing: boolean): void {
    this.search.hidden = !isBrowsing;
    this.list.hidden = !isBrowsing;
    this.panel.hidden = isBrowsing;
    this.offlineNote.hidden = navigator.onLine || !isBrowsing;
  }

  private renderContent(): void {
    this.applyPanelAvailability = null;
    this.showBrowsing(true);
    this.panel.replaceChildren();
    this.renderTopBar(this.openPack?.name ?? PICKER_TITLE, this.openPack !== null);
    this.renderRowActionBar();
    this.rows = this.visibleRows();
    this.activeIndex = Math.min(this.activeIndex, Math.max(this.rows.length - 1, 0));
    this.list.replaceChildren();
    if (this.library.prompts.length === 0 && this.library.packs.length === 0) {
      this.renderNote(EMPTY_LIBRARY_MESSAGE, true);
      this.syncRowActions();
      return;
    }
    if (this.rows.length === 0) {
      const query = this.input.value.trim();
      this.renderNote(query.length > 0 ? `No prompts match "${query}".` : "This pack has no prompts yet.", false);
      this.syncRowActions();
      return;
    }
    this.rows.forEach((row, index) => this.list.append(this.createRow(row, index)));
    this.syncActiveRow();
  }

  private renderTopBar(titleText: string, withBack: boolean): void {
    const leading = document.createElement("span");
    leading.className = "pz-win__leading";
    if (withBack) {
      leading.append(button("back", null, "All packs", () => this.leavePack(), "nav"));
    }
    const title = document.createElement("span");
    title.className = "pz-win__title";
    title.textContent = titleText;
    const trailing = document.createElement("span");
    trailing.className = "pz-win__trailing";
    trailing.append(button("close", null, "Close", this.callbacks.onClose, "muted"));
    this.topBar.replaceChildren(leading, title, trailing);
  }

  private renderRowActionBar(): void {
    this.bottomBar.replaceChildren(
      button("edit", null, "Edit selected prompt", () => this.startEditing(this.activePrompt())),
      button("trash", null, "Delete selected prompt", () => this.confirmDelete(this.activePrompt())),
    );
  }

  private activePrompt(): Prompt | null {
    const row = this.rows[this.activeIndex];
    return row?.kind === "prompt" ? row.prompt : null;
  }

  private syncRowActions(): void {
    const online = navigator.onLine;
    const hasActivePrompt = this.activePrompt() !== null;
    const actionButtons = [
      ...this.bottomBar.querySelectorAll<HTMLButtonElement>("button"),
      ...this.list.querySelectorAll<HTMLButtonElement>("button.pz-picker__row-action"),
    ];
    actionButtons.forEach((actionButton) => {
      const isRowButton = actionButton.classList.contains("pz-picker__row-action");
      actionButton.disabled = !online || (!isRowButton && !hasActivePrompt);
      if (online) {
        actionButton.removeAttribute("title");
      } else {
        actionButton.title = OFFLINE_SAVE_MESSAGE;
      }
    });
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
    element.append(label, meta);
    if (row.kind === "pack") {
      label.textContent = row.pack.name;
      meta.textContent = String(row.pack.promptCount);
      element.setAttribute(
        "aria-label",
        `${row.pack.name} pack, ${row.pack.promptCount} ${row.pack.promptCount === 1 ? "prompt" : "prompts"}`,
      );
    } else {
      const prompt = row.prompt;
      label.textContent = prompt.title;
      meta.textContent = this.openPack === null ? (prompt.category?.name ?? "") : "";
      element.setAttribute("aria-label", prompt.title);
      const rowActions = [
        button("edit", null, `Edit ${prompt.title}`, () => this.startEditing(prompt)),
        button("trash", null, `Delete ${prompt.title}`, () => this.confirmDelete(prompt)),
      ];
      rowActions.forEach((rowAction) => {
        rowAction.classList.add("pz-picker__row-action");
        rowAction.tabIndex = -1;
      });
      element.append(...rowActions);
    }
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

  private returnToList(focusPromptId: string | null): void {
    this.mode = { kind: "browsing" };
    this.renderContent();
    const focusIndex = this.rows.findIndex((row) => row.kind === "prompt" && row.prompt.id === focusPromptId);
    if (focusIndex >= 0) {
      this.activeIndex = focusIndex;
      this.syncActiveRow();
    }
    this.input.focus();
  }

  private openPanel(titleText: string): void {
    this.showBrowsing(false);
    this.input.removeAttribute("aria-activedescendant");
    this.renderTopBar(titleText, false);
    this.panel.removeAttribute("aria-labelledby");
    this.panel.replaceChildren();
    this.bottomBar.replaceChildren();
  }

  private startEditing(prompt: Prompt | null): void {
    if (prompt === null || !navigator.onLine) {
      return;
    }
    const thisOpening = this.openCount;
    const editing: Extract<PickerMode, { kind: "editing" }> = { kind: "editing", prompt, isSaving: false };
    this.mode = editing;
    this.openPanel("Edit prompt");

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "pz-picker__input";
    titleInput.setAttribute("aria-label", "Prompt title");
    titleInput.value = prompt.title;
    const titleError = panelMessage(TITLE_ERROR_ID, true);
    const textArea = document.createElement("textarea");
    textArea.className = "pz-win__body pz-picker__text";
    textArea.setAttribute("aria-label", "Prompt text");
    textArea.spellcheck = false;
    textArea.value = prompt.text;
    const textError = panelMessage(TEXT_ERROR_ID, true);
    const formError = panelMessage(null, true);
    formError.setAttribute("role", "alert");
    const offlineNote = offlineWriteNote();
    this.panel.append(titleInput, titleError, textArea, textError, formError, offlineNote);

    const cancelButton = button("close", null, "Cancel edit", () => this.returnToList(prompt.id));
    const saveButton = button("check", null, "Save changes", () => void save(), "primary");
    this.bottomBar.append(cancelButton, saveButton);

    this.applyPanelAvailability = (online) => {
      offlineNote.hidden = online;
      if (!editing.isSaving) {
        saveButton.disabled = !online;
      }
    };
    this.applyPanelAvailability(navigator.onLine);

    const save = async (): Promise<void> => {
      if (editing.isSaving || !navigator.onLine) {
        return;
      }
      const changes = changedFields(prompt, titleInput.value.trim(), textArea.value);
      if (changes.title === undefined && changes.text === undefined) {
        this.returnToList(prompt.id);
        return;
      }
      showFieldError(titleInput, titleError);
      showFieldError(textArea, textError);
      formError.textContent = "";
      editing.isSaving = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      const response = await this.callbacks.onSaveEdit(prompt.id, changes);
      if (thisOpening !== this.openCount || !this.isOpen) {
        return;
      }
      editing.isSaving = false;
      if (response.ok) {
        this.library = {
          prompts: this.library.prompts.map((cached) => (cached.id === response.prompt.id ? response.prompt : cached)),
          packs: this.library.packs,
        };
        this.returnToList(response.prompt.id);
        return;
      }
      saveButton.disabled = !navigator.onLine;
      cancelButton.disabled = false;
      const fieldErrors = response.kind === "validation" ? response.fields : {};
      showFieldError(titleInput, titleError, fieldErrors.title);
      showFieldError(textArea, textError, fieldErrors.text);
      if (fieldErrors.title === undefined && fieldErrors.text === undefined) {
        formError.textContent = response.message;
      }
      (fieldErrors.title !== undefined ? titleInput : fieldErrors.text !== undefined ? textArea : saveButton).focus();
    };

    titleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        void save();
      }
    });
    titleInput.focus();
  }

  private confirmDelete(prompt: Prompt | null): void {
    if (prompt === null || !navigator.onLine) {
      return;
    }
    const thisOpening = this.openCount;
    const confirming: Extract<PickerMode, { kind: "confirming-delete" }> = {
      kind: "confirming-delete",
      prompt,
      isDeleting: false,
    };
    this.mode = confirming;
    this.openPanel("Delete prompt");

    const question = document.createElement("p");
    question.className = "pz-picker__question";
    question.id = DELETE_QUESTION_ID;
    question.textContent = `Delete “${prompt.title}”?`;
    const warning = panelMessage(null, false);
    warning.textContent = DELETE_WARNING;
    const failure = panelMessage(null, true);
    failure.setAttribute("role", "alert");
    const offlineNote = offlineWriteNote();
    this.panel.setAttribute("aria-labelledby", DELETE_QUESTION_ID);
    this.panel.append(question, warning, failure, offlineNote);

    const cancelButton = button("close", null, "Cancel", () => this.returnToList(prompt.id));
    const deleteButton = button("trash", null, "Delete prompt", () => void remove(), "primary");
    deleteButton.classList.add("pz-win__btn--critical");
    this.bottomBar.append(cancelButton, deleteButton);

    this.applyPanelAvailability = (online) => {
      offlineNote.hidden = online;
      if (!confirming.isDeleting) {
        deleteButton.disabled = !online;
      }
    };
    this.applyPanelAvailability(navigator.onLine);

    const remove = async (): Promise<void> => {
      if (confirming.isDeleting || !navigator.onLine) {
        return;
      }
      failure.textContent = "";
      confirming.isDeleting = true;
      deleteButton.disabled = true;
      cancelButton.disabled = true;
      deleteButton.setAttribute("aria-label", "Deleting…");
      const response = await this.callbacks.onDelete(prompt.id);
      if (thisOpening !== this.openCount || !this.isOpen) {
        return;
      }
      confirming.isDeleting = false;
      if (response.ok) {
        this.library = withoutPrompt(this.library, prompt.id);
        this.returnToList(null);
        return;
      }
      deleteButton.setAttribute("aria-label", "Delete prompt");
      deleteButton.disabled = !navigator.onLine;
      cancelButton.disabled = false;
      failure.textContent = response.message;
      cancelButton.focus();
    };

    cancelButton.focus();
  }

  private syncActiveRow(): void {
    const rowElements = this.list.querySelectorAll<HTMLElement>('[role="option"]');
    rowElements.forEach((element, index) => element.setAttribute("aria-selected", String(index === this.activeIndex)));
    this.syncRowActions();
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

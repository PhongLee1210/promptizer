import { accountSession } from "../../account/account-session.ts";
import { library } from "../../library/library.ts";
import type { LibraryStatus } from "../../library/library-manager.ts";
import { banner, button, footerNote, sectionHeading, setButtonBusy } from "../components";
import { el } from "../dom";

function countOf(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatLastSynced(fetchedAt: number | undefined): string {
  if (fetchedAt === undefined) {
    return "Never synced";
  }
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - fetchedAt);
  if (seconds < 60) {
    return "Synced just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Synced ${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Synced ${hours}h ago`;
  }
  return `Synced ${Math.floor(hours / 24)}d ago`;
}

export function renderSyncStatus(): HTMLElement {
  const host = el("div", { class: "pz-sync-status" });

  function render(status: LibraryStatus): void {
    const refreshButton = button({
      label: "Refresh",
      variant: "outline",
      onClick: async () => {
        setButtonBusy(refreshButton, true);
        await refresh();
        setButtonBusy(refreshButton, false);
      },
    });
    const children: (Node | string)[] = [
      sectionHeading(
        "Library",
        `${countOf(status.prompts.length, "prompt", "prompts")}, ${countOf(status.packs.length, "pack", "packs")}`,
      ),
      footerNote(formatLastSynced(status.fetchedAt)),
    ];
    if (status.lastError) {
      children.push(banner({ kind: "warning", text: status.lastError }));
    } else if (status.isStale) {
      children.push(banner({ kind: "info", text: "Your library may be out of date." }));
    }
    children.push(refreshButton);
    host.replaceChildren(...children);
  }

  async function refresh(): Promise<void> {
    const token = await accountSession.getAccessToken();
    if (!token.ok || token.value === undefined) {
      return;
    }
    render(await library.refresh(token.value));
  }

  void library.current().then((initial) => {
    render({ ...initial, lastError: undefined });
    if (initial.isStale) {
      void refresh();
    }
  });

  return host;
}

import { FileTextIcon, FolderIcon, KeyRoundIcon, LayoutTemplateIcon, type LucideIcon } from "lucide-react";

export interface NavLinkItem {
  id: string;
  title: string;
  url: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavLinkItem[];
}

export const NEW_PROMPT_URL = "/prompts/new";

export const sidebarItems: NavGroup[] = [
  {
    id: "prompts",
    label: "Prompts",
    items: [{ id: "all-prompts", title: "All prompts", url: "/prompts", icon: FileTextIcon }],
  },
  {
    id: "packs",
    label: "Packs",
    items: [{ id: "all-packs", title: "Packs", url: "/packs", icon: FolderIcon }],
  },
  {
    id: "account",
    label: "Account",
    items: [{ id: "password", title: "Change password", url: "/account/password", icon: KeyRoundIcon }],
  },
  {
    id: "reference",
    label: "Reference",
    items: [{ id: "examples", title: "Examples", url: "/examples", icon: LayoutTemplateIcon }],
  },
];

export const THEME_STORAGE_KEY = "promptizer-theme";

export type ThemeChoice = "light" | "dark" | "system";

export const PRE_PAINT_THEME_SCRIPT = `(function(){try{var stored=localStorage.getItem("${THEME_STORAGE_KEY}");var prefersLight=window.matchMedia("(prefers-color-scheme: light)").matches;var mode=stored==="light"||stored==="dark"?stored:prefersLight?"light":"dark";document.documentElement.setAttribute("data-pz-mode",mode);}catch(error){document.documentElement.setAttribute("data-pz-mode","dark");}})();`;

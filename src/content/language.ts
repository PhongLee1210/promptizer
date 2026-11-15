export function targetLanguageName(): string {
  try {
    const languages =
      navigator.languages !== undefined && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language || "en"];
    const primaryCode = languages[0]!.split("-")[0]!;
    const code = primaryCode === "en" && languages.length > 1 ? languages[1]!.split("-")[0]! : primaryCode;
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    const name = displayNames.of(code);
    return name !== undefined ? name.charAt(0).toUpperCase() + name.slice(1) : "English";
  } catch {
    return "English";
  }
}

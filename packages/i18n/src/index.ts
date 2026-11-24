import { en } from "./en";

export { en };

export type Locale = "en";
export type Dictionary = { readonly [key: string]: string };

const dictionaries: Record<Locale, Dictionary> = { en };

export function createTranslator(locale: Locale): (key: string) => string {
  const dictionary = dictionaries[locale] ?? en;
  return (key: string): string => dictionary[key] ?? key;
}

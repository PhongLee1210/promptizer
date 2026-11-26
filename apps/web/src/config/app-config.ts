import packageJson from "../../package.json";

export const APP_CONFIG = {
  name: "Promptizer",
  version: packageJson.version,
  copyright: `© ${new Date().getFullYear()} Promptizer.`,
  meta: {
    title: "Promptizer",
    description: "Rewrite a messy prompt into one clean paragraph and manage your prompts.",
  },
};

import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOURCE_ROOT = fileURLToPath(new URL("../src/", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const absolutePath = SOURCE_ROOT + specifier.slice(2);
    return nextResolve(pathToFileURL(absolutePath).href, context);
  },
});

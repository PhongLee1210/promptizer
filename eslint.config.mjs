import js from "@eslint/js";

const noComments = {
  rules: {
    "no-comments": {
      meta: { type: "problem", schema: [] },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              context.report({ node: comment, message: "Comments are not allowed; write self-explanatory code." });
            }
          },
        };
      },
    },
  },
};

export default [
  { ignores: ["node_modules/**", "bin/**"] },
  js.configs.recommended,
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: {
        globalThis: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        queueMicrotask: "readonly",
        performance: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        AbortController: "readonly",
        MutationObserver: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        KeyboardEvent: "readonly",
        URL: "readonly",
        chrome: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLElement: "readonly",
        InputEvent: "readonly",
        PromptizerCore: "readonly",
        PromptizerNano: "readonly",
        PromptizerProviderRouter: "readonly",
        PromptizerAdapters: "readonly",
        LanguageModel: "readonly",
        self: "readonly",
        module: "writable",
        require: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
      },
    },
    plugins: { local: noComments },
    rules: {
      "local/no-comments": "error",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      complexity: "off",
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-misleading-character-class": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
];

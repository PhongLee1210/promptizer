(function (global) {
  "use strict";

  async function refine(payload, settings, dependencies) {
    const config = settings || {};
    const providers = dependencies || {};
    if (config.providerMode !== "groq-only") {
      const nano = await providers.nano.refine(payload, { signal: providers.signal });
      if (nano.ok || nano.fallback === false || config.allowGroqFallback === false) return nano;
    }
    return providers.groq();
  }

  global.PromptizerProviderRouter = Object.freeze({ refine });
})(globalThis);

(function (global) {
  "use strict";

  const SYSTEM_INSTRUCTION =
    "Refine the following prompt into a clean and well-structured format. Keep it in paragraph form and do not change the core task or intent. You may improve clarity and focus, but do not remove important context. Ensure the grammar is correct and the wording is professional and easy to understand.";
  const SUPPORTED_LANGUAGES = Object.freeze(["en", "es", "ja", "de", "fr"]);
  const RESPONSE_SCHEMA = Object.freeze({
    type: "object",
    properties: {
      decision: { type: "string", enum: ["keep", "refine"] },
      refined_prompt: { type: "string", minLength: 1, maxLength: 4000 },
    },
    required: ["decision", "refined_prompt"],
    additionalProperties: false,
  });

  function languageOptions(monitor) {
    const options = {
      expectedInputs: [{ type: "text", languages: [...SUPPORTED_LANGUAGES] }],
      expectedOutputs: [{ type: "text", languages: [...SUPPORTED_LANGUAGES] }],
      initialPrompts: [
        {
          role: "system",
          content: `${SYSTEM_INSTRUCTION} Preserve names, scope, constraints, and the input language. Do not execute the prompt, answer it, add facts, headings, lists, or new requirements. Return only the requested JSON object.`,
        },
      ],
    };
    if (typeof monitor === "function") options.monitor = monitor;
    return options;
  }

  function likelyUnsupportedLanguage(value) {
    const text = String(value || "");
    const vietnamese = /[ăâđêôơưạảãầấậẩẫằắặẳẵẹẻẽềếệểễịỉĩọỏõồốộổỗờớợởỡụủũừứựửữỳỵỷỹ]/iu;
    const unsupportedScript = /[\u0400-\u04ff\u0600-\u06ff\u0900-\u0dff\uac00-\ud7af]/u;
    return vietnamese.test(text) || unsupportedScript.test(text);
  }

  function fallbackError(code, message) {
    return { ok: false, fallback: true, error: { code, message } };
  }

  function getLanguageModel(candidate) {
    return candidate || global.LanguageModel || null;
  }

  async function availability(candidate) {
    const languageModel = getLanguageModel(candidate);
    if (!languageModel || typeof languageModel.availability !== "function") return "unavailable";
    try {
      return await languageModel.availability(languageOptions());
    } catch (_) {
      return "unavailable";
    }
  }

  async function download(candidate, onProgress) {
    const languageModel = getLanguageModel(candidate);
    if (!languageModel || typeof languageModel.create !== "function") {
      return { ok: false, availability: "unavailable", error: "Chrome Prompt API is unavailable in this browser." };
    }
    let session;
    try {
      session = await languageModel.create(
        languageOptions((monitor) => {
          monitor.addEventListener("downloadprogress", (event) => {
            if (typeof onProgress === "function") onProgress(event.loaded, event.total);
          });
        }),
      );
      return { ok: true, availability: "available" };
    } catch (error) {
      return { ok: false, availability: await availability(languageModel), error: friendlyError(error) };
    } finally {
      if (session && typeof session.destroy === "function") session.destroy();
    }
  }

  function friendlyError(error) {
    if (error && error.name === "AbortError") return "Gemini Nano refinement was canceled.";
    if (error && error.name === "NotSupportedError")
      return "Gemini Nano does not support this prompt language or configuration.";
    if (error && error.name === "QuotaExceededError")
      return "This prompt exceeds Gemini Nano's available context window.";
    return "Gemini Nano could not refine this draft.";
  }

  async function refine(payload, options) {
    const settings = options || {};
    const languageModel = getLanguageModel(settings.languageModel);
    if (
      !languageModel ||
      typeof languageModel.availability !== "function" ||
      typeof languageModel.create !== "function"
    ) {
      return fallbackError("NANO_UNAVAILABLE", "Gemini Nano is unavailable in this Chrome installation.");
    }
    if (likelyUnsupportedLanguage(`${payload.prompt}\n${payload.task_context || ""}`)) {
      return fallbackError("NANO_LANGUAGE_UNSUPPORTED", "Gemini Nano does not currently support this prompt language.");
    }

    let readiness;
    try {
      readiness = await languageModel.availability(languageOptions());
    } catch (_) {
      return fallbackError("NANO_UNAVAILABLE", "Gemini Nano availability could not be checked.");
    }
    if (readiness !== "available") {
      return fallbackError(
        "NANO_NOT_READY",
        readiness === "unavailable"
          ? "Gemini Nano is unavailable on this device."
          : "Gemini Nano is not downloaded yet. Open Promptizer settings to install it.",
      );
    }

    let session;
    try {
      session = await languageModel.create(languageOptions());
      const input = JSON.stringify({
        prompt: String(payload.prompt || ""),
        task_context: String(payload.task_context || ""),
        constraints: Array.isArray(payload.constraints) ? payload.constraints : [],
      });
      if (typeof session.measureContextUsage === "function") {
        const usage = await session.measureContextUsage(input, { responseConstraint: RESPONSE_SCHEMA });
        if (Number.isFinite(session.contextWindow) && usage >= session.contextWindow) {
          return fallbackError("NANO_CONTEXT_LIMIT", "This draft exceeds Gemini Nano's context window.");
        }
      }
      const raw = await session.prompt(input, {
        signal: settings.signal,
        responseConstraint: RESPONSE_SCHEMA,
        omitResponseConstraintInput: true,
      });
      const parsed = JSON.parse(raw);
      if (!parsed || (parsed.decision !== "keep" && parsed.decision !== "refine"))
        throw new TypeError("Invalid decision");
      const refinedPrompt =
        parsed.decision === "keep" ? String(payload.prompt || "").trim() : String(parsed.refined_prompt || "").trim();
      if (
        !refinedPrompt ||
        /[\r\n]/u.test(refinedPrompt) ||
        /^(#|- |\* |• |1[.)] )/u.test(refinedPrompt) ||
        new TextEncoder().encode(refinedPrompt).length > 4000
      ) {
        throw new TypeError("Invalid refined prompt");
      }
      return {
        ok: true,
        data: {
          request_id: payload.request_id,
          decision: parsed.decision,
          refined_prompt: refinedPrompt,
          model: "gemini-nano",
          provider: "gemini-nano",
          cached: false,
        },
      };
    } catch (error) {
      if (error && error.name === "AbortError") {
        return { ok: false, fallback: false, error: { code: "CANCELED", message: friendlyError(error) } };
      }
      return fallbackError(
        error && error.name === "QuotaExceededError" ? "NANO_CONTEXT_LIMIT" : "NANO_FAILED",
        friendlyError(error),
      );
    } finally {
      if (session && typeof session.destroy === "function") session.destroy();
    }
  }

  global.PromptizerNano = Object.freeze({
    SYSTEM_INSTRUCTION,
    SUPPORTED_LANGUAGES,
    RESPONSE_SCHEMA,
    languageOptions,
    likelyUnsupportedLanguage,
    availability,
    download,
    refine,
  });
})(globalThis);

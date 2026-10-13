javascript
import { getModel } from "../config/llmModels.js";
import redis from "../../../shared/redis/redis.js";
import {
  resolveContextReference,
  detectCombinedWorkflow
} from "../utils/contextManager.js";

const VALID_AGENTS = {
  vision: "vision",
  image: "vision",
  ppt: "ppt",
  pdf: "pdf",
  coding: "coding",
  search: "search",
  billing: "billing",
  pdfrag: "pdfRag",
  rag: "pdfRag",
  chat: "chat",
  auto: "auto"
};

function normalizeAgent(value) {
  if (typeof value !== "string") return null;

  const cleaned = value
    .trim()
    .replace(/^[`"'*\s]+|[`"'*\s]+$/g, "")
    .toLowerCase();

  return VALID_AGENTS[cleaned] || null;
}

function isPdfIntent(text) {
  return (
    /\b(create|make|generate|export|download|convert|compile|save)\b.*\b(pdf|pdf report|pdf document|cheat sheet)\b/i.test(text) ||
    /\b(create|make|generate|export)\s+(?:me\s+)?(?:a\s+)?pdf\b/i.test(text) ||
    /\b(pdf cheat sheet|pdf report|pdf of this|pdf from this|pdf based on)\b/i.test(text) ||
    /\b(turn|convert)\b.*\binto\s+(?:a\s+)?pdf\b/i.test(text)
  );
}

function isPptIntent(text) {
  return (
    /\b(create|make|generate|export|download|convert|compile|save)\b.*\b(ppt|presentation|slides|slide deck|powerpoint|deck)\b/i.test(text) ||
    /\b(create|make|generate)\s+(?:me\s+)?(?:a\s+)?(?:ppt|presentation|slide deck|powerpoint|deck)\b/i.test(text) ||
    /\b(make|create|generate)\s+(?:me\s+)?slides\b/i.test(text) ||
    /\b(turn|convert)\b.*\binto\s+(?:a\s+)?(?:ppt|presentation|slide deck|powerpoint)\b/i.test(text)
  );
}

function detectImageIntent(text) {
  const isImageRetrieval =
    /\b(show|find|get|give|look up|search)\s+(?:me\s+)?(?:a\s+)?(?:real|actual|genuine|authentic|official|original)?\s*(?:photo|picture|photograph|logo|image)\s+(?:of|for)\b/i.test(text) ||
    /\b(real photo of|actual photo of|authentic photo of|official logo of|photo of|picture of)\b/i.test(text);

  const isImageGeneration =
    /\b(generate|create|draw|paint|render|make|design)\s+(?:an?\s+)?(?:image|picture|photo|illustration|wallpaper|artwork|visual|portrait)\b/i.test(text) ||
    /\b(photorealistic|anime style|cartoon style|cyberpunk|watercolor)\b/i.test(text);

  return {
    isImageRetrieval,
    isImageGeneration,
    matched: isImageRetrieval || isImageGeneration
  };
}

function isLiveSearchIntent(text) {
  return (
    /\b(time now|what time|current time|local time|time in|timezone|time zone|clock)\b/i.test(text) ||
    /\b(today'?s date|current date|what date|what day|current year|latest news|recent news|who won|live score|current score|stock price|weather|temperature|forecast|humidity|air quality|aqi)\b/i.test(text) ||
    /\b(latest|breaking news|current events|recent updates)\b/i.test(text)
  );
}

function isBillingIntent(text) {
  return /\b(credits?|balance|subscription|pricing|price|billing|bill|upgrade|plan cost|my plan|payment status)\b/i.test(text);
}

function isCodingIntent(text) {
  return (
    /\b(solve|implement|debug|fix|write|build)\b.*\b(code|function|algorithm|program|script|component|api|website|web app|application|class|query)\b/i.test(text) ||
    /\b(two sum|leetcode|linked list implementation|binary search implementation)\b/i.test(text) ||
    (
      /\b(java|python|javascript|typescript|html|css|sql|react|node\.?js|c\+\+)\b/i.test(text) &&
      /\b(code|coding|debug|implement|function|algorithm|program|script|solve|error|bug)\b/i.test(text)
    )
  );
}

function isDocumentQuestion(text) {
  return /\b(what technologies|what skills|what experience|summarize|summarise|analyze|analyse|extract|read|explain|find|list|answer questions about|what is mentioned|according to)\b/i.test(text);
}

function getImageMode(state, isImageRetrieval) {
  return state.imageMode || (isImageRetrieval ? "retrieval" : "generation");
}

export const router = async (state) => {
  const conversationId = state.conversationId || "default_conv";
  const rawPrompt = state.prompt || "";
  const lower = rawPrompt.toLowerCase().trim();
  const hasFile = Boolean(state.file && state.file.path);
  const rawAgent = (state.agent || "auto").trim().toLowerCase();

  let sourceContext = state.sourceContext;
  let hasReference = false;

  // 1. Respect explicit agent selection from the UI.
  // Do not let automatic classification override the user's selection.
  const manualAgent = normalizeAgent(rawAgent);

  if (manualAgent && manualAgent !== "auto") {
    const image = detectImageIntent(lower);

    console.log(`[Router] Explicit UI selection -> [${manualAgent}]`);

    return {
      ...state,
      agent: manualAgent,
      imageMode:
        manualAgent === "vision"
          ? getImageMode(state, image.isImageRetrieval)
          : state.imageMode
    };
  }

  // 2. Uploaded images go to the image analyzer when automatic mode is used.
  if (hasFile && state.file.mimetype?.startsWith("image/")) {
    console.log("[Router] Uploaded image -> [imageAnalyzer]");

    return {
      ...state,
      agent: "imageAnalyzer"
    };
  }

  // 3. Resolve references to earlier messages and generated content.
  try {
    const resolved = await resolveContextReference(
      rawPrompt,
      conversationId
    );

    hasReference = Boolean(resolved?.hasReference);
    sourceContext = resolved?.sourceContext || sourceContext;
  } catch (error) {
    console.warn(
      "[Router] Context resolution warning:",
      error.message
    );
  }

  // 4. Handle requests that explicitly request document creation.
  const pdfIntent = isPdfIntent(lower);
  const pptIntent = isPptIntent(lower);

  if (pdfIntent && pptIntent) {
    try {
      const combined = detectCombinedWorkflow(rawPrompt, hasFile);

      if (combined?.isCombined) {
        console.log(
          `[Router] Combined workflow: ${combined.primaryAgent} -> ${combined.nextAgent}`
        );

        return {
          ...state,
          agent: combined.primaryAgent,
          nextAgent: combined.nextAgent,
          sourceContext: sourceContext || state.sourceContext
        };
      }
    } catch (error) {
      console.warn(
        "[Router] Combined workflow warning:",
        error.message
      );
    }

    // If both formats are requested but no workflow is detected,
    // select the format mentioned first.
    const pdfIndex = lower.search(/\bpdf\b/i);
    const pptIndex = lower.search(/\b(ppt|presentation|slides|powerpoint|deck)\b/i);
    const selectedAgent =
      pdfIndex !== -1 && (pptIndex === -1 || pdfIndex < pptIndex)
        ? "pdf"
        : "ppt";

    return {
      ...state,
      agent: selectedAgent,
      sourceContext: sourceContext || state.sourceContext
    };
  }

  if (pdfIntent) {
    console.log(
      `[Router] PDF generation intent detected. Has source context: ${Boolean(sourceContext)}`
    );

    return {
      ...state,
      agent: "pdf",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  if (pptIntent) {
    console.log(
      `[Router] PPT generation intent detected. Has source context: ${Boolean(sourceContext)}`
    );

    return {
      ...state,
      agent: "ppt",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  // 5. Detect combined workflows, for example:
  // "Search the latest information about Virat Kohli and make a PPT".
  try {
    const combined = detectCombinedWorkflow(rawPrompt, hasFile);

    if (combined?.isCombined) {
      console.log(
        `[Router] Detected chained workflow: ${combined.primaryAgent} -> ${combined.nextAgent}`
      );

      return {
        ...state,
        agent: combined.primaryAgent,
        nextAgent: combined.nextAgent,
        sourceContext: sourceContext || state.sourceContext
      };
    }
  } catch (error) {
    console.warn(
      "[Router] Combined workflow detection warning:",
      error.message
    );
  }

  // 6. Route real-time queries to search.
  if (isLiveSearchIntent(lower)) {
    console.log("[Router] Live information query -> [search]");

    return {
      ...state,
      agent: "search",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  // 7. Route account and credit questions to billing.
  if (isBillingIntent(lower)) {
    console.log("[Router] Billing intent detected");

    return {
      ...state,
      agent: "billing",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  // 8. Route image generation and retrieval separately.
  const image = detectImageIntent(lower);

  if (image.matched) {
    const imageMode = image.isImageRetrieval
      ? "retrieval"
      : "generation";

    console.log(`[Router] Image intent -> [vision], mode: ${imageMode}`);

    return {
      ...state,
      agent: "vision",
      imageMode,
      sourceContext: sourceContext || state.sourceContext
    };
  }

  // 9. Uploaded non-image files go to document RAG unless the user
  // explicitly requested PDF/PPT generation above.
  if (hasFile) {
    console.log("[Router] Uploaded document -> [pdfRag]");

    return {
      ...state,
      agent: "pdfRag",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  // 10. Check for documents previously uploaded in this conversation.
  let hasConvDocs = false;

  try {
    const stored = await redis.get(`conv_docs:${conversationId}`);

    if (stored) {
      const parsed = JSON.parse(stored);
      hasConvDocs = Array.isArray(parsed) && parsed.length > 0;
    }
  } catch (error) {
    console.warn(
      "[Router] Conversation document lookup warning:",
      error.message
    );
  }

  if (
    hasConvDocs &&
    isDocumentQuestion(lower) &&
    /\b(document|file|uploaded|sheet|excel|csv|resume|data|table|analysis|analyze|analyse|notes|text|findings|skills|experience)\b/i.test(lower)
  ) {
    console.log("[Router] Uploaded document question -> [pdfRag]");

    return {
      ...state,
      agent: "pdfRag",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  // 11. Follow-up coding requests that refer to earlier context.
  if (
    hasReference &&
    sourceContext &&
    /\b(code|implement|function|class|program|script|react|java|python|javascript|typescript|html|debug|algorithm)\b/i.test(lower)
  ) {
    return {
      ...state,
      agent: "coding",
      sourceContext
    };
  }

  // 12. Recognize straightforward coding requests without the LLM.
  if (isCodingIntent(lower)) {
    console.log("[Router] Coding intent detected");

    return {
      ...state,
      agent: "coding",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  // 13. Use the LLM for remaining ambiguous requests.
  try {
    const llm = await getModel("router");

    const prompt = `You are the intent classifier for Nexora.

Select exactly one agent based on the user's primary request.

Available agents:
vision = generate or retrieve an image.
ppt = create a PowerPoint presentation or slide deck.
pdf = create or export a PDF document.
coding = write, implement, or debug code.
search = current information, news, weather, time, sports results, or web research.
billing = credits, account balance, subscriptions, pricing, or payments.
pdfRag = questions about uploaded documents or files.
chat = general conversation, explanations, concepts, advice, or questions.

Examples:
"make a ppt on rohit sharma" -> ppt
"create a presentation about cloud computing" -> ppt
"make a PPT from this feedback" -> ppt
"generate an image of a cybernetic tiger" -> vision
"create a PDF cheat sheet for Docker" -> pdf
"solve two sum in Java" -> coding
"what is the latest news today" -> search
"how many credits do I have" -> billing
"what technologies are mentioned in this resume" -> pdfRag
"explain recursion" -> chat

User request:
${rawPrompt}

Return exactly one agent name:
vision, ppt, pdf, coding, search, billing, pdfRag, chat`;

    const response = await llm.invoke(prompt);

    const responseText =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content
              .map((item) =>
                typeof item === "string"
                  ? item
                  : item?.text || ""
              )
              .join(" ")
          : "";

    // Validate the entire response instead of matching an agent
    // name anywhere in a longer response.
    const normalized = normalizeAgent(responseText);

    if (normalized && normalized !== "auto") {
      console.log(
        `[Router] Classified prompt "${rawPrompt.slice(0, 50)}..." -> [${normalized}]`
      );

      return {
        ...state,
        agent: normalized,
        imageMode:
          normalized === "vision"
            ? getImageMode(state, image.isImageRetrieval)
            : state.imageMode,
        sourceContext: sourceContext || state.sourceContext
      };
    }

    console.warn(
      `[Router] Invalid LLM classification: "${responseText.slice(0, 100)}"`
    );
  } catch (error) {
    console.warn(
      "[Router Error] Falling back to heuristic classification:",
      error.message
    );
  }

  // 14. Final fallback if the LLM fails or returns an invalid response.
  if (isBillingIntent(lower)) {
    return { ...state, agent: "billing" };
  }

  if (isPptIntent(lower)) {
    return {
      ...state,
      agent: "ppt",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  if (isPdfIntent(lower)) {
    return {
      ...state,
      agent: "pdf",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  if (image.matched) {
    return {
      ...state,
      agent: "vision",
      imageMode: getImageMode(state, image.isImageRetrieval)
    };
  }

  if (isLiveSearchIntent(lower)) {
    return { ...state, agent: "search" };
  }

  if (isCodingIntent(lower)) {
    return {
      ...state,
      agent: "coding",
      sourceContext: sourceContext || state.sourceContext
    };
  }

  return {
    ...state,
    agent: "chat",
    sourceContext: sourceContext || state.sourceContext
  };
};
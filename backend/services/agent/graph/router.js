import { getModel } from "../config/llmModels.js"
import redis from "../../../shared/redis/redis.js"
import { resolveContextReference, detectCombinedWorkflow } from "../utils/contextManager.js"

export const router = async (state) => {
  const conversationId = state.conversationId || "default_conv"
  const rawPrompt = state.prompt || ""
  const lower = rawPrompt.toLowerCase().trim()
  const hasFile = Boolean(state.file && state.file.path)

  // 1. File attachments & Combined Workflows
  if (hasFile) {
    if (state.file.mimetype && state.file.mimetype.startsWith("image/")) {
      return {
        ...state,
        agent: "imageAnalyzer"
      }
    }

    // Check for combined workflow (e.g. "Analyze my resume and create a PDF report")
    const combined = detectCombinedWorkflow(rawPrompt, true)
    if (combined.isCombined) {
      console.log(`[Router] Detected combined workflow for document upload: ${combined.primaryAgent} -> ${combined.nextAgent}`)
      return {
        ...state,
        agent: combined.primaryAgent,
        nextAgent: combined.nextAgent
      }
    }

    // Standard document RAG analysis
    return {
      ...state,
      agent: "pdfRag"
    }
  }

  // 1.5 Check for non-file Combined Workflows (e.g. "Search latest info about Virat Kohli and make a PPT")
  const combinedNonFile = detectCombinedWorkflow(rawPrompt, false)
  if (combinedNonFile.isCombined) {
    console.log(`[Router] Detected chained workflow: ${combinedNonFile.primaryAgent} -> ${combinedNonFile.nextAgent}`)
    return {
      ...state,
      agent: combinedNonFile.primaryAgent,
      nextAgent: combinedNonFile.nextAgent,
      sourceContext: state.sourceContext
    }
  }

  // 2. Explicit manual selection for RAG
  const rawAgent = (state.agent || "").toLowerCase()
  if (rawAgent === "pdfrag" || rawAgent === "rag") {
    return {
      ...state,
      agent: "pdfRag"
    }
  }

  // 3. Resolve References to Previous Agent Context (e.g. "this feedback", "this analysis", "the above", "from the research")
  const { hasReference, sourceContext } = await resolveContextReference(rawPrompt, conversationId)

  // Check PDF generation intent
  const isPdfIntent = (
    /\b(create|make|generate|export|download|put|turn|convert|compile)\s+.*?\b(pdf|document report|pdf report)\b/i.test(lower) ||
    /\b(create a pdf|generate a pdf|make a pdf|export pdf|pdf report|pdf of this|pdf from this|pdf based on)\b/i.test(lower) ||
    /^(create|make|generate|export)\s+(a\s+)?pdf$/i.test(lower)
  )

  if (isPdfIntent) {
    console.log(`[Router] PDF generation intent detected. Has source context: ${Boolean(sourceContext)}`)
    return {
      ...state,
      agent: "pdf",
      sourceContext: sourceContext || state.sourceContext
    }
  }

  // Check PPT presentation intent
  const isPptIntent = (
    /\b(create|make|generate|export|download|put|turn|convert|compile)\s+.*?\b(ppt|presentation|slides|slide deck|powerpoint)\b/i.test(lower) ||
    /\b(create a ppt|generate a ppt|make a ppt|make slides|turn this into a presentation|make a deck)\b/i.test(lower) ||
    /^(create|make|generate|export)\s+(a\s+)?(ppt|presentation|slides|deck)$/i.test(lower)
  )

  if (isPptIntent) {
    console.log(`[Router] PPT generation intent detected. Has source context: ${Boolean(sourceContext)}`)
    return {
      ...state,
      agent: "ppt",
      sourceContext: sourceContext || state.sourceContext
    }
  }

  // 4. Distinct Image Retrieval vs Generation Intent
  const isImageRetrieval = (
    /\b(show|find|get|give|look up|search)\s+(me\s+)?(a\s+)?(real|actual|genuine|authentic|official|original)?\s*(photo|picture|photograph|logo|image)\s+(of|for)\b/i.test(lower) ||
    /\b(real photo of|actual photo of|authentic photo of|official logo of|photo of|picture of)\b/i.test(lower)
  )
  const isImageGeneration = (
    /\b(generate|create|draw|paint|render|make|design)\s+(an?\s+)?(image|picture|photo|illustration|wallpaper|artwork|visual|portrait)\b/i.test(lower) ||
    /\b(photorealistic|anime style|cartoon style|cyberpunk|watercolor)\b/i.test(lower)
  )

  if (isImageRetrieval || isImageGeneration) {
    return {
      ...state,
      agent: "vision",
      imageMode: isImageRetrieval ? "retrieval" : "generation"
    }
  }

  // Check if conversation has uploaded documents and user asks document-related question
  let hasConvDocs = false
  try {
    const stored = await redis.get(`conv_docs:${conversationId}`)
    if (stored && JSON.parse(stored)?.length > 0) {
      hasConvDocs = true
    }
  } catch (e) {}

  if (hasConvDocs && /\b(document|file|uploaded|sheet|excel|csv|resume|data|table|analyze|excerpt|notes|text|findings)\b/i.test(lower)) {
    return {
      ...state,
      agent: "pdfRag",
      sourceContext: sourceContext || state.sourceContext
    }
  }

  // If user referenced prior context for coding or explanation
  if (hasReference && sourceContext) {
    if (/\b(code|implement|function|class|program|script|react|java|python|javascript|typescript|html)\b/i.test(lower)) {
      return {
        ...state,
        agent: "coding",
        sourceContext
      }
    }
  }

  // 4. Dynamic intent classification via LLM router
  const llm = await getModel("router")
  const prompt = `You are the central intelligent router for Nexora.
Analyze the user's query and classify it into EXACTLY ONE specialized agent based on the user's true intent.

AVAILABLE AGENTS:
- vision: User wants to generate, draw, create, or see an image, picture, photo, artwork, illustration, visual, or wallpaper.
- ppt: User wants to create, make, generate, or view a PowerPoint presentation, slide deck, slides, or PPT.
- pdf: User wants to generate, create, export, or format a PDF document, cheat sheet, formal report, or document.
- coding: User wants to write code, build a web app, implement an algorithm, debug code, create a component, API, database query, or technical script.
- search: User is asking about real-time current events, latest news, recent updates, live sports scores, weather, stock prices, or internet lookup.
- billing: User is asking about their account, subscription, plan, credits, balance, pricing, upgrades, cost of agents, or billing.
- pdfRag: User is asking about an uploaded document, file content, resume, dataset, or document questions.
- chat: General conversation, explanations, concepts, Q&A, greetings, math, logic, reasoning, or advice.

ROUTING EXAMPLES:
- "make a ppt on rohit sharma" -> ppt
- "create a 5-slide presentation on cloud computing" -> ppt
- "now make a PPT from this feedback" -> ppt
- "generate an image of a cybernetic tiger" -> vision
- "create a pdf cheat sheet for docker" -> pdf
- "create a PDF report of this analysis" -> pdf
- "now create a pdf of this feedback" -> pdf
- "solve two sum in Java" -> coding
- "what is today's date" -> chat
- "what is the current year" -> chat
- "what time is it" -> chat
- "what is the latest news today" -> search
- "who won the cricket match yesterday" -> search
- "current stock price of Google" -> search
- "how many credits do I have" -> billing
- "what technologies are mentioned in this resume" -> pdfRag
- "explain what recursion is" -> chat

User Query:
"${state.prompt}"

Current UI Selection (for reference only): ${state.agent || "auto"}

Return ONLY the single word representing the agent:
vision | ppt | pdf | coding | search | billing | pdfRag | chat`

  try {
    const response = await llm.invoke(prompt)
    const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content || "")
    const matched = text.match(/(vision|ppt|pdfRag|pdf|coding|search|billing|chat)/i)?.[0]

    if (matched) {
      const normalized = matched.toLowerCase() === "pdfrag" ? "pdfRag" : matched.toLowerCase()
      console.log(`[Router] Classified prompt "${state.prompt.slice(0, 50)}..." -> [${normalized}]`)
      return {
        ...state,
        agent: normalized,
        imageMode: normalized === "vision" ? (state.imageMode || (isImageRetrieval ? "retrieval" : "generation")) : state.imageMode,
        sourceContext: sourceContext || state.sourceContext
      }
    }
  } catch (err) {
    console.log("[Router Error] Falling back to heuristic classification:", err.message)
  }

  // Heuristic Fallback
  if (/\b(credits?|balance|subscription|pricing|price|bill|billing|upgrade|plan cost)\b/i.test(lower)) {
    return { ...state, agent: "billing" }
  }
  if (/\b(image|picture|photo|illustration|draw|wallpaper|visual|render)\b/i.test(lower)) {
    return {
      ...state,
      agent: "vision",
      imageMode: state.imageMode || (isImageRetrieval ? "retrieval" : "generation")
    }
  }
  if (/\b(ppt|presentation|slides|slide deck|powerpoint)\b/i.test(lower)) {
    return { ...state, agent: "ppt", sourceContext: sourceContext || state.sourceContext }
  }
  if (/\b(pdf|cheat sheet|report document|export pdf|create pdf)\b/i.test(lower)) {
    return { ...state, agent: "pdf", sourceContext: sourceContext || state.sourceContext }
  }
  if (/\b(code|coding|function|algorithm|class|component|debug|java|python|javascript|typescript|html|css|sql|react|node|c\+\+)\b/i.test(lower)) {
    return { ...state, agent: "coding", sourceContext: sourceContext || state.sourceContext }
  }
  if (/\b(latest|news|today|recent|current|score|live|weather|temperature|temp|forecast|climate|rain|humidity|aqi|stock|price|who won)\b/i.test(lower)) {
    return { ...state, agent: "search" }
  }

  return {
    ...state,
    agent: (state.agent && state.agent !== "auto") ? state.agent : "chat",
    sourceContext: sourceContext || state.sourceContext
  }
}
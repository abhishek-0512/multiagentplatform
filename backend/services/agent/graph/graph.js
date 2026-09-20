import { StateGraph } from "@langchain/langgraph";
import { agentState } from "./state.js";
import { router } from "./router.js";
import { chatAgent } from "../agents/chat.agent.js";
import { searchAgent } from "../agents/search.agent.js";
import { codingAgent } from "../agents/coding.agent.js";
import { pdfAgent } from "../agents/pdf.agent.js";
import { pptAgent } from "../agents/ppt.agent.js";
import { visionAgent } from "../agents/vision.agent.js";
import { pdfRag } from "../agents/pdfRag.agent.js";
import { imageAnalyzer } from "../agents/imageAnalyzer.agent.js";
import { billingAgent } from "../agents/billing.agent.js";

const workflow = new StateGraph(agentState)

workflow.addNode("router", router)
workflow.addNode("chat", chatAgent)
workflow.addNode("search", searchAgent)
workflow.addNode("coding", codingAgent)
workflow.addNode("pdf", pdfAgent)
workflow.addNode("ppt", pptAgent)
workflow.addNode("vision", visionAgent)
workflow.addNode("pdfRag", pdfRag)
workflow.addNode("imageAnalyzer", imageAnalyzer)
workflow.addNode("billing", billingAgent)

workflow.addEdge("__start__", "router")

workflow.addConditionalEdges("router", (state) => {
  switch (state.agent) {
    case "chat":
      return "chat";
    case "search":
      return "search";
    case "coding":
      return "coding";
    case "pdf":
      return "pdf";
    case "ppt":
      return "ppt";
    case "vision":
      return "vision";
    case "pdfRag":
      return "pdfRag";
    case "imageAnalyzer":
      return "imageAnalyzer";
    case "billing":
      return "billing";
    default:
      return "chat";
  }
}, {
  chat: "chat",
  search: "search",
  coding: "coding",
  pdf: "pdf",
  ppt: "ppt",
  vision: "vision",
  pdfRag: "pdfRag",
  imageAnalyzer: "imageAnalyzer",
  billing: "billing"
})

// Chained handoffs from RAG analysis (e.g. combined prompt: analyze + PDF / PPT)
workflow.addConditionalEdges("pdfRag", (state) => {
  if (state.nextAgent === "pdf") return "pdf";
  if (state.nextAgent === "ppt") return "ppt";
  return "__end__";
}, {
  pdf: "pdf",
  ppt: "ppt",
  __end__: "__end__"
})

// Chained handoffs from Search
workflow.addConditionalEdges("search", (state) => {
  if (state.nextAgent === "pdf") return "pdf";
  if (state.nextAgent === "ppt") return "ppt";
  return "__end__";
}, {
  pdf: "pdf",
  ppt: "ppt",
  __end__: "__end__"
})

workflow.addEdge("chat", "__end__")
workflow.addEdge("coding", "__end__")
workflow.addEdge("pdf", "__end__")
workflow.addEdge("ppt", "__end__")
workflow.addEdge("vision", "__end__")
workflow.addEdge("imageAnalyzer", "__end__")
workflow.addEdge("billing", "__end__")

export const graph = workflow.compile()
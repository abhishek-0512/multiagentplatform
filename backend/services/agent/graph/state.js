import { Annotation } from "@langchain/langgraph";

export const agentState = Annotation.Root({
    prompt: Annotation(),
    aiResponse: Annotation(),
    agent: Annotation(),
    nextAgent: Annotation(),
    conversationId: Annotation(),
    searchResults: Annotation(),
    images: Annotation(),
    artifacts: Annotation(),
    sources: Annotation(),
    userId: Annotation(),
    file: Annotation(),
    sourceContext: Annotation(),
    structuredData: Annotation(),
    handoffCount: Annotation()
})
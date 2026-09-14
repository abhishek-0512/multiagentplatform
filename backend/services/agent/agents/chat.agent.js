import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getModel } from "../config/llmModels.js"
import { getMemory } from "../config/memory.js"

export const chatAgent = async (state) => {
    try {
        const llm = await getModel("chat")
        const history = state.conversationId ? await getMemory(state.conversationId) : []

        const now = new Date()
        const formattedDate = now.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        const formattedTime = now.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        const isoTime = now.toISOString()

        const searchContext = state.searchResults ? `
Web Search Results:

${JSON.stringify(state.searchResults)}

Answer the user using only the above search results.
` : ""

        const systemPrompt = `
You are CortexAI, an intelligent AI assistant.

Real-Time Temporal Context:
- Current Date: ${formattedDate}
- Current Time: ${formattedTime} (${timezone}, UTC ISO: ${isoTime})
- You have real-time access to the current date and time via the anchor above. Always use this real-time temporal anchor when answering questions about current time, date, day of the week, year, or live events.

${searchContext}

If searchContext exists:
- Use search results to answer.
- Do not mention internal tools.

Rules:
- For simple questions, greetings, time/date queries, and short queries, respond naturally in plain text.
- For technical, educational, coding, or detailed topics, use clean Markdown.

Formatting:
- Use # for titles and ## for sections.
- Leave a blank line after headings.
- Use bullet points for lists.
- Use numbered lists for steps.
- Use fenced code blocks with language tags for code.
- Keep paragraphs short and readable.
- Never write headings and content on the same line.
- Never generate large walls of text.
`
        const messages = [
            new SystemMessage(systemPrompt)
        ]

        if (Array.isArray(history)) {
            history.forEach(msg => {
                if (msg.role === "user" && msg.content) {
                    messages.push(new HumanMessage(msg.content))
                }
                if (msg.role === "assistant" && msg.content) {
                    messages.push(new AIMessage(msg.content))
                }
            })
        }

        messages.push(new HumanMessage(state.prompt))

        const response = await llm.invoke(messages)

        return {
            ...state,
            aiResponse: response.content
        }
    } catch (error) {
        console.error("chatAgent error:", error)
        return {
            ...state,
            aiResponse: error?.response?.data?.message || error?.message || "Failed to generate chat response"
        }
    }
}
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getModel } from "../config/llmModels.js"
import { getMemory } from "../config/memory.js"
import { deductCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"
import { saveAgentContext } from "../utils/contextManager.js"

export const chatAgent = async (state) => {
    try {
        const conversationId = state.conversationId || "default_conv"
        await checkAgentLimit(state.userId, "chat")

        const llm = await getModel("chat")
        const history = await getMemory(conversationId)

        const now = new Date()
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        const formattedDate = now.toLocaleDateString('en-US', dateOptions)
        const formattedTime = now.toLocaleTimeString('en-US')
        const currentYear = now.getFullYear()

        const tzFormat = (tz) => new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "full", timeStyle: "medium" }).format(now)
        const timezones = [
            `• Local / India (IST): ${tzFormat("Asia/Kolkata")}`,
            `• UTC / GMT: ${tzFormat("UTC")}`,
            `• London (UK): ${tzFormat("Europe/London")}`,
            `• New York (US East): ${tzFormat("America/New_York")}`,
            `• San Francisco / LA (US West): ${tzFormat("America/Los_Angeles")}`,
            `• Tokyo (Japan): ${tzFormat("Asia/Tokyo")}`,
            `• Sydney (Australia): ${tzFormat("Australia/Sydney")}`
        ].join("\n")

        const temporalContext = `CURRENT RUNTIME TEMPORAL & LOCATION CONTEXT:
Today is ${formattedDate}.
Current Local Time (IST): ${formattedTime} (Asia/Kolkata, UTC+5:30).
Current Year: ${currentYear}.
Current Server Location / Primary Timezone: India (IST, Asia/Kolkata).

Accurate Live Times Across Global Timezones:
${timezones}
`

        const searchContext = state.searchResults ? `
Web Search Results:
${JSON.stringify(state.searchResults)}

Answer the user using the above search results. Be factual and detailed.
` : ""

        const priorContext = state.sourceContext ? `
Prior Context (${state.sourceContext.title || state.sourceContext.sourceAgent || "Context"}):
${state.sourceContext.content ? state.sourceContext.content.slice(0, 4000) : ""}
` : ""

        const systemPrompt = `
You are Nexora, an intelligent collaborative AI assistant.

${temporalContext}
${searchContext}
${priorContext}

Rules:
- For simple questions, greetings, and short queries (e.g. today's date, time, basic questions), respond naturally in plain text.
- For technical, educational, coding, or detailed topics, use clean Markdown.
- If search context is present, cite facts and details accurately.
- Never write headings and content on the same line.
- Never generate large walls of text.
`
        const messages = [
            new SystemMessage(systemPrompt)
        ]

        if (Array.isArray(history)) {
            history.forEach(msg => {
                if (msg.role === "user") {
                    messages.push(new HumanMessage(msg.content))
                }
                if (msg.role === "assistant" && msg.content) {
                    messages.push(new AIMessage(msg.content))
                }
            })
        }

        messages.push(new HumanMessage(state.prompt))

        const response = await llm.invoke(messages)
        const answerText = typeof response.content === "string" ? response.content : JSON.stringify(response.content || "")
        await deductCredits(state.userId, "chat").catch(() => {})

        const effectiveAgent = state.searchResults?.length > 0 ? "search" : (state.agent || "chat")

        // Save context for downstream handoffs (e.g. Chat/Search -> PDF / PPT)
        await saveAgentContext(conversationId, {
            agent: effectiveAgent,
            prompt: state.prompt,
            title: `Explanation: ${state.prompt}`,
            content: answerText,
            sources: state.sources || [],
            artifacts: state.artifacts || []
        })

        return {
            ...state,
            agent: effectiveAgent,
            nextAgent: null,
            aiResponse: answerText
        }
    } catch (error) {
        console.log("Chat Agent Error:", error)
        return {
            ...state,
            agent: state.agent || "chat",
            nextAgent: null,
            aiResponse: error?.data?.message || "Failed to generate response."
        }
    }
}
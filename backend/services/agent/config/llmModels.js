import dotenv from "dotenv"
dotenv.config()
import { ChatGroq } from "@langchain/groq"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"

const groqApiKey = (process.env.GROQ_API_KEY || "").trim()
const googleApiKey = (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim()

// Groq Heavy/Deep Reasoning Model: openai/gpt-oss-120b (High quality detailed output, 4096 tokens)
const groqGpt120b = new ChatGroq({
    apiKey: groqApiKey,
    model: "openai/gpt-oss-120b",
    temperature: 0.2,
    maxTokens: 4096
})

// Groq Fast Reasoning: qwen/qwen3.8-27b (~100ms response time, reliable code & structured reasoning)
const groqQwen = new ChatGroq({
    apiKey: groqApiKey,
    model: "qwen/qwen3.8-27b",
    temperature: 0.1,
    maxTokens: 4096
})

// Groq Secondary: openai/gpt-oss-20b
const groqGpt20b = new ChatGroq({
    apiKey: groqApiKey,
    model: "openai/gpt-oss-20b",
    temperature: 0.1,
    maxTokens: 4096
})

// Groq Resilient: allam-2-7b
const groqAllam = new ChatGroq({
    apiKey: groqApiKey,
    model: "allam-2-7b",
    temperature: 0.1,
    maxTokens: 4096
})

// Google Gemini
const geminiFlash = new ChatGoogleGenerativeAI({
    apiKey: googleApiKey,
    model: "gemini-2.5-flash",
    temperature: 0.1,
    maxOutputTokens: 4096
})

/**
 * Resilient LLM Wrapper with automatic graceful failover
 */
class ResilientLLM {
    constructor(primary, fallbacks = []) {
        this.primary = primary
        this.fallbacks = fallbacks
    }

    async invoke(input, options) {
        const models = [this.primary, ...this.fallbacks].filter(Boolean)
        let lastError = null

        for (let i = 0; i < models.length; i++) {
            const model = models[i]
            try {
                const res = await model.invoke(input, options)
                if (res && res.content) {
                    const text = typeof res.content === "string" ? res.content.trim() : JSON.stringify(res.content)
                    if (text.length > 0) {
                        return { ...res, content: text }
                    }
                }
            } catch (err) {
                lastError = err
                console.warn(`[ResilientLLM] Tier ${i + 1} (${model.model || "LLM"}) error: ${err.message?.slice(0, 100)}...`)
            }
        }

        throw lastError || new Error("All LLM model tiers failed to generate a response.")
    }
}

// Resilient Model Instances
const resilientDeep = new ResilientLLM(groqGpt120b, [groqQwen, groqGpt20b, geminiFlash])
const resilientMain = new ResilientLLM(groqQwen, [groqGpt120b, groqGpt20b, geminiFlash])
const resilientFast = new ResilientLLM(groqQwen, [groqGpt20b, geminiFlash])
const resilientVision = new ResilientLLM(geminiFlash, [groqQwen, groqGpt20b])

export const getModel = async (agent) => {
    switch (agent) {
        case "chat":
            return resilientDeep;
        case "search":
            return resilientMain;
        case "coding":
            return resilientMain;
        case "imageAnalyzer":
            return resilientVision;
        case "pdf":
        case "ppt":
            return resilientDeep;
        case "router":
        case "intent":
        case "image":
            return resilientFast;
        case "pdf-rag":
        case "pdfRag":
            return resilientDeep;
        default:
            return resilientDeep;
    }
}

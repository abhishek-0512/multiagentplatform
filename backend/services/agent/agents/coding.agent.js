import { getModel } from "../config/llmModels.js"
import { getMemory } from "../config/memory.js"

export const codingAgent = async (state) => {
    try {
        const intentLlm = await getModel("intent")
        const llm = await getModel("coding")
        const history = state.conversationId ? await getMemory(state.conversationId) : []

        const intentRes = await intentLlm.invoke(`
You are an intent classifier.

Return ONLY one of these values:
CODE_GENERATION
CODE_REVIEW
CODE_EXPLANATION
DEBUGGING
OPTIMIZATION
CONVERSION
DOCUMENTATION

User Request:
${state.prompt}
`)
        const rawIntent = (intentRes.content || "").replace(/[`*_\n\r]/g, "").trim().toUpperCase()
        const isCodeGeneration = rawIntent.includes("CODE_GENERATION")

        let conversationContext = ""
        if (Array.isArray(history) && history.length > 0) {
            const recent = history.slice(-4)
            conversationContext = `\nRecent Conversation Context:\n` + recent.map(m => `${m.role}: ${m.content}`).join("\n") + "\n"
        }

        if (isCodeGeneration) {
            const prompt = `
You are CortexAI Coding Agent.

Generate the requested project.
${conversationContext}
Default stack:
- HTML
- CSS
- JavaScript

Use React / Next.js / Vue ONLY if explicitly requested.

Rules:
- Responsive
- Modern UI
- CSS Variables
- Flexbox/Grid
- Smooth Scroll
- Hover Effects
- Beautiful spacing
- Single page unless user asks otherwise.

IMAGES
=========================
Always use real Unsplash images.
Never use placeholders.

Return ONLY valid JSON.

Schema:
{
  "files":[
    {
      "name":"index.html",
      "content":"..."
    },
    {
      "name":"style.css",
      "content":"..."
    },
    {
      "name":"script.js",
      "content":"..."
    }
  ]
}

Rules:
- Output must start with {
- Output must end with }
- No markdown outside JSON
- No explanation
- No extra text

User Request:
${state.prompt}
`
            const res = await llm.invoke(prompt)
            const rawContent = res.content || ""
            const cleanContent = rawContent.replace(/```json\s*|```/g, "").trim()
            let files = []

            try {
                const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanContent)
                if (Array.isArray(parsed?.files)) {
                    files = parsed.files
                }
            } catch (parseErr) {
                console.error("JSON parse error in coding agent, attempting markdown fallback:", parseErr.message)
                
                // Fallback: extract code blocks if JSON was formatted as markdown
                const htmlMatch = rawContent.match(/```(?:html)?\s*([\s\S]*?)```/i)
                const cssMatch = rawContent.match(/```(?:css)?\s*([\s\S]*?)```/i)
                const jsMatch = rawContent.match(/```(?:js|javascript)?\s*([\s\S]*?)```/i)

                if (htmlMatch) files.push({ name: "index.html", content: htmlMatch[1].trim() })
                if (cssMatch && (!htmlMatch || cssMatch[1] !== htmlMatch[1])) files.push({ name: "style.css", content: cssMatch[1].trim() })
                if (jsMatch && (!htmlMatch || jsMatch[1] !== htmlMatch[1]) && (!cssMatch || jsMatch[1] !== cssMatch[1])) {
                    files.push({ name: "script.js", content: jsMatch[1].trim() })
                }
            }

            return {
                ...state,
                aiResponse: files.length > 0 ? "Code Generated Successfully." : (cleanContent || "Code Generated Successfully."),
                artifacts: [
                    {
                        id: Date.now(),
                        type: "Project",
                        files: files,
                        title: state.prompt
                    }
                ]
            }
        }

        const res = await llm.invoke(`
The user's request is:

${rawIntent || "CODE_EXPLANATION"}
${conversationContext}
Return Markdown only.
Never generate project files.

Use headings like:
# Overview
## Explanation
## Problems
## Improvements
## Best Practices
## Optimized Code (if needed)

User Request:
${state.prompt}
`)

        return {
            ...state,
            aiResponse: res.content || "",
            artifacts: []
        }
    } catch (error) {
        console.error("codingAgent error:", error)
        return {
            ...state,
            aiResponse: error?.response?.data?.message || error?.message || "failed to generate code",
            artifacts: []
        }
    }
}
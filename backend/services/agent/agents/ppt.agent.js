import { getModel } from "../config/llmModels.js"
// import { generatePpt } from "../utils/generatePpt.js"
// import { getFromS3 } from "../utils/getFromS3.js"
// import { uploadToS3 } from "../utils/uploadToS3.js"
// import { deductCredits } from "../utils/deductCredits.js"
// import { checkAgentLimit } from "../config/agentLimit.js"
export const pptAgent=async (state) => {
    try {
        // await checkAgentLimit(state.userId,"ppt")
        const llm=await getModel("ppt")
        const prompt=`You are a professional presentation designer.

Return ONLY valid JSON.

Format:

{
"title":"",
"subtitle":"",
"slides":[
{
"title":"",
"points":[
"",
"",
"",
""
]
}
]
}

Rules:

- Generate exactly 6 content slides.
- Each slide should have 4-6 concise bullet points.
- No markdown.
- No explanation.
- No code block.
- Return ONLY JSON.

Topic:

${state.prompt}`

const res=await llm.invoke(prompt)
const cleanContent = (res.content || "").replace(/```json\s*|```/g, "").trim()
let data = null
try {
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
    data = JSON.parse(jsonMatch ? jsonMatch[0] : cleanContent)
} catch (parseErr) {
    console.error("JSON parse error in ppt agent:", parseErr)
}

if (data && data.title) {
    const slidesText = (data.slides || []).map((slide, idx) => 
        `### Slide ${idx + 1}: ${slide.title || ""}\n${(slide.points || []).map(p => `- ${p}`).join("\n")}`
    ).join("\n\n")

    return {
        ...state,
        aiResponse: `# Presentation Outline: ${data.title}\n\n${data.subtitle ? `*${data.subtitle}*\n\n` : ""}${slidesText}`
    }
}

return {
    ...state,
    aiResponse: cleanContent
}

    } catch (error) {
        console.log(error)
         return {
            ...state,
            aiResponse: error?.response?.data?.message || error?.message || "failed to generate ppt"
        }
       

       
    }
}
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
const cleanContent = res.content.replace(/```json\s*|```/g, "").trim()
const data=JSON.parse(cleanContent)
// await deductCredits(state.userId,"ppt")

return {
    ...state,
    aiResponse:`# ✅ Presentation Outline Generated

**${data.title}**

${data.subtitle || ""}
`
}

    } catch (error) {
        console.log(error)
         return {
            ...state,
            aiResponse: error?.response?.data?.message || error?.message || "failed to generate ppt"
        }
       

       
    }
}
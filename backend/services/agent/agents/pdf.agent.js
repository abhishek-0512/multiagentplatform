import { getModel } from "../config/llmModels.js"
// import { generatePdf } from "../utils/generatePdf.js"
// import { getFromS3 } from "../utils/getFromS3.js"
// import { uploadToS3 } from "../utils/uploadToS3.js"
// import { deductCredits } from "../utils/deductCredits.js"
// import { checkAgentLimit } from "../config/agentLimit.js"
export const pdfAgent=async (state) => {
    try {
        // const rate=await checkAgentLimit(state.userId,"pdf")
        
        
        const llm=await getModel("pdf")
        const prompt=`
        You are an expert document writer.

Return ONLY valid JSON.

Do NOT return markdown.

Do NOT return explanations.

Structure:

{
"title":"",
"subtitle":"",
"sections":[
{
"heading":"",
"points":[]
}
]
}

Generate 4-8 sections.

Each section should have 3-6 concise bullet points.

Topic:

${state.prompt}
        `

        const res=await llm.invoke(prompt)
        const cleanContent = (res.content || "").replace(/```json\s*|```/g, "").trim()
        let data = null
        try {
            const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
            data = JSON.parse(jsonMatch ? jsonMatch[0] : cleanContent)
        } catch (parseErr) {
            console.error("JSON parse error in pdf agent:", parseErr)
        }

        if (data && data.title) {
            const sectionsText = (data.sections || []).map(sec => 
                `### ${sec.heading || ""}\n${(sec.points || []).map(p => `- ${p}`).join("\n")}`
            ).join("\n\n")

            return {
                ...state,
                aiResponse: `# PDF Outline: ${data.title}\n\n${data.subtitle ? `*${data.subtitle}*\n\n` : ""}${sectionsText}`
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
            aiResponse: error?.response?.data?.message || error?.message || "failed to generate pdf"
        }
    }
}
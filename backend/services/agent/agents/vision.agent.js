import { getModel } from "../config/llmModels.js"
import axios from "axios"
// import { uploadToS3 } from "../utils/uploadToS3.js"
// import { getFromS3 } from "../utils/getFromS3.js"
// import { deductCredits } from "../utils/deductCredits.js"
// import { checkAgentLimit } from "../config/agentLimit.js"
export const visionAgent=async (state) => {

    try {
        // await checkAgentLimit(state.userId,"image")
         const llm=await getModel("image")
    const res=await llm.invoke(`
        You are an elite AI image prompt engineer.

Convert the user request into a highly detailed image generation prompt.

Requirements:

- Cinematic lighting
- Professional composition
- Ultra realistic
- High detail
- Beautiful color palette
- Sharp focus
- 8K quality
- Photorealistic
- Depth of field
- Professional photography
- Stunning visuals

Return only the image prompt.

User Request:
${state.prompt}

        `)

const prompt=res.content.trim()

const imageUrl=`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
// await deductCredits(state.userId,"vision")

return {
    ...state,
    images:[imageUrl],
    aiResponse:`
![Generated Image](${imageUrl})

📥 [Download Image](${imageUrl})`
}
    } catch (error) {
       console.log(error)
         return {
            ...state,
            aiResponse: error?.response?.data?.message || error?.message || "failed to generate image"
        }
    }
   


}
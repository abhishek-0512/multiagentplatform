// import { checkAgentLimit } from "../config/agentLimit.js"
// import { searchTool } from "../config/tavily.js"
// import { deductCredits } from "../utils/deductCredits.js"
export const searchAgent = async (state) => {
    try {
        // await checkAgentLimit(state.userId, "search")
        const results = { results: [], images: [] }
        // await deductCredits(state.userId, "search")
        console.log(results)
        return {
            ...state,
            searchResults: results,
            images: results.images
        }
    } catch (error) {
        console.log(error)
        return {
            ...state,
            searchResults: [],
            images: [],
            aiResponse: error?.response?.data?.message || error?.message || "failed to search"
        }
    }
}
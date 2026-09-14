import { searchTool } from "../config/tavily.js"

export const searchAgent = async (state) => {
    try {
        const rawResults = await searchTool.invoke({ query: state.prompt })
        const results = rawResults?.results || []
        const images = rawResults?.images || []
        
        return {
            ...state,
            searchResults: results,
            images: images
        }
    } catch (error) {
        console.error("searchAgent error:", error)
        return {
            ...state,
            searchResults: [],
            images: [],
            aiResponse: error?.response?.data?.message || error?.message || "failed to perform web search"
        }
    }
}
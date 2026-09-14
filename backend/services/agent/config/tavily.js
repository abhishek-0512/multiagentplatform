import { TavilySearch } from "@langchain/tavily"
import dotenv from "dotenv"
dotenv.config()

export const searchTool = new TavilySearch({
    apiKey: process.env.TAVILY_API_KEY || "",
    maxResults: 5
})
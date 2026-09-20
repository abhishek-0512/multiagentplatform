import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import dotenv from "dotenv"
dotenv.config()

export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim(),
  model: "gemini-embedding-001"
});
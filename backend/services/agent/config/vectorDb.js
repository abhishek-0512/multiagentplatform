import { QdrantVectorStore } from "@langchain/qdrant";
import { embeddings } from "./embeddings.js";
import dotenv from "dotenv";
dotenv.config();

const getQdrantConfig = () => {
    return {
        url: (process.env.QDRANT_URL || process.env.QDRANT_ENDPOINT || "").trim(),
        apiKey: (process.env.QDRANT_API_KEY || "").trim()
    };
};

export const vectorStore = async (docs, collectionName) => {
    const config = getQdrantConfig();
    return await QdrantVectorStore.fromDocuments(docs, embeddings, {
        url: config.url,
        apiKey: config.apiKey,
        collectionName
    });
};

export const getVectorStore = async (collectionName) => {
    const config = getQdrantConfig();
    return await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: config.url,
        apiKey: config.apiKey,
        collectionName
    });
};
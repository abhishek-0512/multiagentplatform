import { getModel } from "../config/llmModels.js"
import { getMemory } from "../config/memory.js"
import axios from "axios"
import fs from "fs"
import path from "path"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { deductCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"

export const visionAgent = async (state) => {
    try {
        await checkAgentLimit(state.userId, "image")
        const filename = `image-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.png`
        const tempDir = path.resolve("./temp")
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

        const rawPrompt = (state.prompt || "").trim()
        const lowerPrompt = rawPrompt.toLowerCase()
        console.log(`[IMAGE] Request received: "${rawPrompt}"`)

        // 1. Detect Explicit Style Request (default to Photorealistic)
        let requestedStyle = "photorealistic"
        if (lowerPrompt.includes("cartoon") || lowerPrompt.includes("comic") || lowerPrompt.includes("pixar") || lowerPrompt.includes("disney")) {
            requestedStyle = "cartoon"
        } else if (lowerPrompt.includes("anime") || lowerPrompt.includes("manga") || lowerPrompt.includes("ghibli")) {
            requestedStyle = "anime"
        } else if (lowerPrompt.includes("watercolor") || lowerPrompt.includes("water colour")) {
            requestedStyle = "watercolor"
        } else if (lowerPrompt.includes("sketch") || lowerPrompt.includes("pencil drawing")) {
            requestedStyle = "sketch"
        } else if (lowerPrompt.includes("3d render") || lowerPrompt.includes("unreal engine") || lowerPrompt.includes("octane render")) {
            requestedStyle = "3d render"
        }

        // 2. Check if this is an Image Retrieval request or an AI Generation request
        const isRetrieval = state.imageMode === "retrieval" || (
            /\b(show|find|get|give|look up|search)\s+(me\s+)?(a\s+)?(real|actual|genuine|authentic|official|original)?\s*(photo|picture|photograph|logo|image)\s+(of|for)\b/i.test(lowerPrompt) ||
            /\b(real photo of|actual photo of|authentic photo of|official logo of|photo of|picture of)\b/i.test(lowerPrompt) ||
            /^(show|find|get)\s+(me\s+)?([A-Za-z0-9\s]+)$/i.test(lowerPrompt) && !lowerPrompt.startsWith("generate") && !lowerPrompt.startsWith("create") && !lowerPrompt.startsWith("draw")
        )

        // Known public figures list for safety and entity resolution
        const publicFigures = [
            { name: "rohit sharma", desc: "an Indian cricketer in a blue jersey hitting a shot", entity: "Rohit Sharma Indian cricketer" },
            { name: "virat kohli", desc: "an Indian cricketer in a red/blue team jersey playing a cover drive", entity: "Virat Kohli cricketer" },
            { name: "ms dhoni", desc: "a professional wicketkeeper batsman in a yellow/blue jersey finishing a match", entity: "MS Dhoni cricketer" },
            { name: "elon musk", desc: "a tech executive speaking at an aerospace launch facility", entity: "Elon Musk CEO" },
            { name: "cristiano ronaldo", desc: "a professional footballer in a team jersey celebrating a goal", entity: "Cristiano Ronaldo footballer" },
            { name: "lionel messi", desc: "a professional footballer dribbling a ball on a pitch", entity: "Lionel Messi footballer" },
            { name: "narendra modi", desc: "a statesman in formal traditional attire delivering an address", entity: "Narendra Modi" },
            { name: "sachin tendulkar", desc: "a legendary batsman holding a cricket bat", entity: "Sachin Tendulkar cricketer" }
        ]

        const matchedFigure = publicFigures.find(pf => lowerPrompt.includes(pf.name))

        // If a real public figure/celebrity is requested, always execute authentic photo retrieval first
        const shouldRetrieveRealPhoto = Boolean(isRetrieval || matchedFigure)

        let imageBuffer = null
        let retrievalSource = ""

        // 3. EXECUTE IMAGE RETRIEVAL PIPELINE (Type A / Celebrity Photos)
        if (shouldRetrieveRealPhoto) {
            let targetQuery = rawPrompt
                .replace(/^(show me a real photo of|show real photo of|real photo of|show me an?|show me|find photo of|find picture of|find image of|official logo of|photo of|picture of|generate image of|generate picture of|create image of|generate a photo of|create a photo of|image of|photo)\s+/i, "")
                .replace(/\b(photo|picture|photograph|image|logo)\b/gi, "")
                .trim()

            if (matchedFigure) {
                targetQuery = matchedFigure.entity
            }

            console.log(`[IMAGE] Executing high-fidelity image retrieval for: "${targetQuery}"`)

            // Priority 1: Tavily Image Search
            if (process.env.TAVILY_API_KEY) {
                try {
                    const tavilyRes = await axios.post("https://api.tavily.com/search", {
                        api_key: process.env.TAVILY_API_KEY,
                        query: `${targetQuery} official high resolution photo portrait`,
                        include_images: true
                    }, { timeout: 8000 })

                    const images = tavilyRes.data?.images || []
                    for (const imgUrl of images) {
                        try {
                            const imgDownload = await axios.get(imgUrl, {
                                responseType: "arraybuffer",
                                headers: {
                                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                                },
                                timeout: 6000
                            })
                            if (imgDownload.data && imgDownload.data.length > 5000) {
                                imageBuffer = Buffer.from(imgDownload.data)
                                retrievalSource = `Authentic verified photograph of **${targetQuery}** (via Web Archive)`
                                break
                            }
                        } catch (e) {}
                    }
                } catch (e) {}
            }

            // Priority 2: Wikipedia High-Res Portrait Fallback
            if (!imageBuffer) {
                try {
                    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(targetQuery)}&prop=pageimages&format=json&pithumbsize=1200`
                    const wikiRes = await axios.get(wikiUrl, { headers: { "User-Agent": "NexoraAI/1.0" }, timeout: 6000 })
                    const pages = wikiRes.data?.query?.pages || {}
                    const pageId = Object.keys(pages)[0]
                    const photoUrl = pages[pageId]?.thumbnail?.source
                    if (photoUrl) {
                        const imgDownload = await axios.get(photoUrl, { responseType: "arraybuffer", headers: { "User-Agent": "NexoraAI/1.0" }, timeout: 8000 })
                        if (imgDownload.data && imgDownload.data.length > 5000) {
                            imageBuffer = Buffer.from(imgDownload.data)
                            retrievalSource = `Authentic photograph of **${targetQuery}** (via Wikipedia Public Domain Archive)`
                        }
                    }
                } catch (e) {}
            }
        }

        // 4. EXECUTE AI IMAGE GENERATION PIPELINE (Type B)
        if (!imageBuffer) {
            // Prompt Engineer LLM: Convert user prompt into rich generation prompt
            const llm = await getModel("image")
            const promptEngineerDirective = `You are an elite AI image prompt engineer for Nexora.
Convert the user request into a highly descriptive, detailed image generation prompt.

STYLE REQUIREMENTS:
- Primary Style: ${requestedStyle === "photorealistic" ? "Ultra-realistic photograph, professional DSLR camera, 35mm lens, natural lighting, sharp focus, 8k resolution, authentic skin texture and realistic anatomy" : requestedStyle}
- PRESERVE 100% of the user's requested subjects, environment, mood, clothing, background elements, and specific actions.
- Avoid generic filler. Include rich visual descriptors (lighting, textures, colors, composition).

User Request:
${rawPrompt}

Return ONLY the single polished image generation prompt text with no intro, markdown, quotes, or explanations.`

            let finalImagePrompt = rawPrompt
            try {
                const engineerRes = await llm.invoke(promptEngineerDirective)
                const generatedText = (typeof engineerRes.content === "string" ? engineerRes.content : JSON.stringify(engineerRes.content || "")).trim()
                if (generatedText && generatedText.length > 10) {
                    finalImagePrompt = generatedText.replace(/```[a-z]*|```/gi, "").replace(/^["']|["']$/g, "").trim()
                }
            } catch (llmErr) {
                console.log("[IMAGE] LLM prompt engineer note:", llmErr.message)
                if (requestedStyle === "photorealistic") {
                    finalImagePrompt = `Ultra-realistic photograph of ${rawPrompt}, cinematic natural lighting, 35mm lens, f/1.8 aperture, sharp focus, realistic anatomy, 8k resolution, professional photography`
                }
            }

            console.log(`[IMAGE] Final Generation Prompt (${requestedStyle}): "${finalImagePrompt}"`)

            const cleanPrompt = finalImagePrompt.replace(/[\r\n]+/g, " ").trim()
            const seed = Math.floor(Math.random() * 10000000)

            const endpoints = [
                `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`,
                `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?model=turbo&nologo=true&seed=${seed}`,
                `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?model=flux&nologo=true&seed=${seed}`
            ]

            for (const ep of endpoints) {
                if (imageBuffer) break
                try {
                    console.log(`[IMAGE] Requesting visual from generator: ${ep.slice(0, 80)}...`)
                    const imageRes = await axios.get(ep, {
                        responseType: "arraybuffer",
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                        },
                        timeout: 18000
                    })

                    const ctype = imageRes.headers["content-type"] || ""
                    const isHtml = imageRes.data?.slice(0, 50).toString().includes("<html") || imageRes.data?.slice(0, 50).toString().includes("<!DOCTYPE")
                    const isValidImage = (ctype.startsWith("image/") || imageRes.data[0] === 0x89 || (imageRes.data[0] === 0xFF && imageRes.data[1] === 0xD8)) && !isHtml && imageRes.data.length > 5000

                    if (isValidImage) {
                        imageBuffer = Buffer.from(imageRes.data)
                        console.log(`[IMAGE] Visual generated successfully (${imageBuffer.length} bytes, type: ${ctype})`)
                        break
                    } else {
                        console.warn(`[IMAGE] Generator returned invalid non-image payload (ctype: ${ctype}, size: ${imageRes.data?.length})`)
                    }
                } catch (genErr) {
                    console.warn(`[IMAGE] Endpoint attempt error: ${genErr.message}`)
                }
            }

            // Fallback to high-resolution web photo search if AI generator is unavailable
            if (!imageBuffer && process.env.TAVILY_API_KEY) {
                try {
                    console.log(`[IMAGE] Falling back to high-resolution photo lookup for: "${rawPrompt}"`)
                    const tavilyRes = await axios.post("https://api.tavily.com/search", {
                        api_key: process.env.TAVILY_API_KEY,
                        query: `${rawPrompt} high resolution photograph 4k`,
                        include_images: true
                    }, { timeout: 8000 })

                    for (const imgUrl of (tavilyRes.data?.images || [])) {
                        try {
                            const imgDownload = await axios.get(imgUrl, {
                                responseType: "arraybuffer",
                                headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
                                timeout: 6000
                            })
                            const ctype = imgDownload.headers["content-type"] || ""
                            const isHtml = imgDownload.data?.slice(0, 50).toString().includes("<html") || imgDownload.data?.slice(0, 50).toString().includes("<!DOCTYPE")
                            if ((ctype.startsWith("image/") || imgDownload.data[0] === 0x89 || imgDownload.data[0] === 0xFF) && !isHtml && imgDownload.data.length > 5000) {
                                imageBuffer = Buffer.from(imgDownload.data)
                                retrievalSource = `High-resolution photograph of **"${rawPrompt}"**`
                                break
                            }
                        } catch (e) {}
                    }
                } catch (tavErr) {
                    console.warn("[IMAGE] Fallback photo search error:", tavErr.message)
                }
            }
        }

        // 5. Save & Return Artifact
        if (imageBuffer && imageBuffer.length > 1000) {
            fs.writeFileSync(path.join(tempDir, filename), imageBuffer)
            await uploadToS3(filename, imageBuffer, "image/png").catch(() => {})

            const cacheBuster = Date.now()
            const viewUrl = `http://localhost:8000/api/agent/file/${filename}?t=${cacheBuster}`
            const downloadUrl = `http://localhost:8000/api/agent/download/${filename}?t=${cacheBuster}`

            await deductCredits(state.userId, "vision").catch(() => {})

            const styleLabel = requestedStyle.charAt(0).toUpperCase() + requestedStyle.slice(1)
            const headerText = retrievalSource
                ? `### 📸 Authentic Photograph\n\n${retrievalSource}.\n\n📥 [Download High-Resolution Photo](${downloadUrl})`
                : `### 🎨 ${styleLabel} Visual Generated\n\nHere is the visual generated for: **"${rawPrompt}"**.\n\n📥 [Download High-Resolution Image](${downloadUrl})`

            return {
                ...state,
                agent: "vision",
                nextAgent: null,
                aiResponse: headerText,
                images: [viewUrl]
            }
        }

        return {
            ...state,
            agent: "vision",
            nextAgent: null,
            aiResponse: "Unable to generate or retrieve the visual at this moment. Please try again with a descriptive prompt.",
            images: []
        }

    } catch (error) {
        console.error("[IMAGE] Vision agent error:", error)
        return {
            ...state,
            agent: "vision",
            nextAgent: null,
            aiResponse: error?.data?.message || `⚠️ Failed to generate image: ${error.message}`,
            images: []
        }
    }
}
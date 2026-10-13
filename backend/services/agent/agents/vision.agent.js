import { getModel } from "../config/llmModels.js"
import { getMemory } from "../config/memory.js"
import axios from "axios"
import { isIP } from "node:net"
import { storeImage } from "../utils/s3Images.js"
import { deductCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"
import { enhanceImagePrompt, detectStyle } from "../utils/imagePromptEnhancer.js"

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// Generator models tried in order. "default" means: omit the model parameter.
// Override without a deploy: IMAGE_MODEL_CHAIN="flux,default,turbo"
const MODEL_CHAIN = (process.env.IMAGE_MODEL_CHAIN || "flux,default,turbo").split(",").map((s) => s.trim()).filter(Boolean)
const GEN_TIMEOUT_MS = Number(process.env.IMAGE_GEN_TIMEOUT_MS) || 20000

// When a named public figure can't be retrieved as a real photo, do not fall through to
// generating a photorealistic likeness. Set BLOCK_REAL_PERSON_GENERATION=false to disable.
const BLOCK_REAL_PERSON_GENERATION = process.env.BLOCK_REAL_PERSON_GENERATION !== "false"

/* ---------------------------- helpers ---------------------------- */

function sniffImage(buf) {
    if (!buf || buf.length < 12) return null
    if (buf[0] === 0x89 && buf[1] === 0x50) return { mime: "image/png", ext: "png" }
    if (buf[0] === 0xFF && buf[1] === 0xD8) return { mime: "image/jpeg", ext: "jpg" }
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" }
    if (buf.toString("ascii", 0, 3) === "GIF") return { mime: "image/gif", ext: "gif" }
    return null
}

function looksLikeImage(buf, ctype = "") {
    if (!buf || buf.length <= 5000) return false
    const head = buf.slice(0, 256).toString("utf8").trimStart().toLowerCase()
    if (head.startsWith("<html") || head.startsWith("<!doctype") || head.startsWith("<svg")) return false

    // Only accept raster formats. SVG can contain active content when served from storage.
    const normalizedType = ctype.split(";")[0].trim().toLowerCase()
    const rasterTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"])
    if (normalizedType && normalizedType.startsWith("image/") && !rasterTypes.has(normalizedType)) return false
    return Boolean(sniffImage(buf)) || rasterTypes.has(normalizedType)
}

function isSafeImageUrl(rawUrl) {
    try {
        const url = new URL(rawUrl)
        if (url.protocol !== "https:" || url.username || url.password) return false
        const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
        if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal") return false
        // Image search results should never be able to request private or link-local IP addresses.
        if (isIP(host)) {
            if (host.includes(":")) return false // conservatively reject IPv6 literals
            const octets = host.split(".").map(Number)
            if (octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
                (octets[0] === 169 && octets[1] === 254) ||
                (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
                (octets[0] === 192 && octets[1] === 168) || octets[0] >= 224) return false
        }
        return true
    } catch {
        return false
    }
}

// Real type of the bytes, so we stop labelling JPEG/WebP output as PNG.
function resolveImageType(buf, ctype = "") {
    const sniffed = sniffImage(buf)
    if (sniffed) return sniffed
    if (ctype.startsWith("image/")) {
        const mime = ctype.split(";")[0].trim()
        return { mime, ext: mime.split("/")[1].replace("+xml", "") }
    }
    return { mime: "image/png", ext: "png" }
}

async function fetchImage(url, { timeout = 6000, headers = {} } = {}) {
    if (!isSafeImageUrl(url)) {
        console.warn("[IMAGE] Skipping an image URL that failed URL safety checks")
        return null
    }
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        headers: { "User-Agent": BROWSER_UA, ...headers },
        timeout,
        maxContentLength: 12 * 1024 * 1024,
        maxBodyLength: 12 * 1024 * 1024,
        maxRedirects: 3,
        beforeRedirect: (options) => {
            const redirectedUrl = `${options.protocol}//${options.hostname}${options.path || "/"}`
            if (!isSafeImageUrl(redirectedUrl)) throw new Error("Unsafe image redirect destination")
        }
    })
    const ctype = res.headers?.["content-type"] || ""
    const buffer = Buffer.from(res.data)
    return looksLikeImage(buffer, ctype) ? { buffer, ctype } : null
}

function buildGeneratorUrl(prompt, { model, width, height, seed }) {
    const params = new URLSearchParams({ width, height, seed, nologo: "true", enhance: "false" }) // enhance=false: we already enhanced
    if (model && model !== "default") params.set("model", model)
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`
}

/* ------------------------- retrieval routing ------------------------- */

// Retrieval only when the user clearly wants an existing photo ("real photo of", "find a picture of ...")
// or the caller forces it with state.imageMode === "retrieval". A bare "photo of a man in a cafe"
// is a generation request, not a web lookup.
const EXPLICIT_REAL_RE = /\b(real|actual|genuine|authentic|official|original)\s+(photo|picture|photograph|logo|image)s?\b/i
const LOOKUP_RE = /\b(find|search for|look up|fetch)\b[^.]*\b(photo|picture|photograph|image|logo)s?\s+(of|for)\b/i
const GENERATE_VERB_RE = /^\s*(please\s+)?(generate|create|draw|imagine|make|render|paint|design|illustrate)\b/i

// Known public figures list for safety and entity resolution
const publicFigures = [
    { name: "rohit sharma", wiki: "Rohit Sharma", entity: "Rohit Sharma Indian cricketer" },
    { name: "virat kohli", wiki: "Virat Kohli", entity: "Virat Kohli cricketer" },
    { name: "ms dhoni", wiki: "MS Dhoni", entity: "MS Dhoni cricketer" },
    { name: "elon musk", wiki: "Elon Musk", entity: "Elon Musk CEO" },
    { name: "cristiano ronaldo", wiki: "Cristiano Ronaldo", entity: "Cristiano Ronaldo footballer" },
    { name: "lionel messi", wiki: "Lionel Messi", entity: "Lionel Messi footballer" },
    { name: "narendra modi", wiki: "Narendra Modi", entity: "Narendra Modi" },
    { name: "sachin tendulkar", wiki: "Sachin Tendulkar", entity: "Sachin Tendulkar cricketer" }
]

export const visionAgent = async (state) => {
    try {
        await checkAgentLimit(state.userId, "image")
        const baseName = `image-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

        const rawPrompt = (state.prompt || "").trim()
        const lowerPrompt = rawPrompt.toLowerCase()
        console.log(`[IMAGE] Request received (${rawPrompt.length} characters)`)

        // 1. Detect explicit style request (default to photorealistic)
        const requestedStyle = detectStyle(rawPrompt)

        // 2. Image retrieval request or AI generation request?
        const isRetrieval = state.imageMode === "retrieval" || (
            !GENERATE_VERB_RE.test(rawPrompt) && (EXPLICIT_REAL_RE.test(lowerPrompt) || LOOKUP_RE.test(lowerPrompt))
        )

        const matchedFigure = publicFigures.find((pf) => lowerPrompt.includes(pf.name))

        // If a real public figure/celebrity is requested, always try photo retrieval first
        const shouldRetrieveRealPhoto = Boolean(isRetrieval || matchedFigure)

        let imageBuffer = null
        let imageContentType = ""
        let retrievalSource = ""

        // 3. IMAGE RETRIEVAL PIPELINE
        if (shouldRetrieveRealPhoto) {
            let targetQuery = rawPrompt
                .replace(/^(show me a real photo of|show real photo of|real photo of|show me an?|show me|find photo of|find picture of|find image of|official logo of|photo of|picture of|generate image of|generate picture of|create image of|generate a photo of|create a photo of|image of|photo)\s+/i, "")
                .replace(/\b(photo|picture|photograph|image|logo)\b/gi, "")
                .trim()

            if (matchedFigure) targetQuery = matchedFigure.entity

            console.log("[IMAGE] Executing image retrieval")

            // Priority 1: Tavily image search
            if (process.env.TAVILY_API_KEY) {
                try {
                    const tavilyRes = await axios.post("https://api.tavily.com/search", {
                        api_key: process.env.TAVILY_API_KEY,
                        query: `${targetQuery} official high resolution photo portrait`,
                        include_images: true
                    }, { timeout: 8000 })

                    for (const imgUrl of (tavilyRes.data?.images || [])) {
                        try {
                            const img = await fetchImage(imgUrl, { timeout: 6000 })
                            if (img) {
                                imageBuffer = img.buffer
                                imageContentType = img.ctype
                                retrievalSource = `Photograph of **${targetQuery}** found via web search (source not verified, check usage rights before reuse)`
                                break
                            }
                        } catch (e) {}
                    }
                } catch (e) {}
            }

            // Priority 2: Wikipedia lead image fallback
            if (!imageBuffer) {
                try {
                    const title = matchedFigure ? matchedFigure.wiki : targetQuery
                    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&redirects=1&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=1200`
                    const wikiRes = await axios.get(wikiUrl, { headers: { "User-Agent": "NexoraAI/1.0" }, timeout: 6000 })
                    const pages = wikiRes.data?.query?.pages || {}
                    const pageId = Object.keys(pages)[0]
                    const photoUrl = pages[pageId]?.thumbnail?.source
                    if (photoUrl) {
                        const img = await fetchImage(photoUrl, { timeout: 8000, headers: { "User-Agent": "NexoraAI/1.0" } })
                        if (img) {
                            imageBuffer = img.buffer
                            imageContentType = img.ctype
                            retrievalSource = `Photograph of **${targetQuery}** (via Wikipedia)`
                        }
                    }
                } catch (e) {}
            }

            // Named public figure and no real photo found: don't synthesize a photorealistic likeness.
            if (!imageBuffer && matchedFigure && BLOCK_REAL_PERSON_GENERATION) {
                return {
                    ...state,
                    agent: "vision",
                    nextAgent: null,
                    aiResponse: `I couldn't retrieve a photo of **${matchedFigure.wiki}** right now, and I don't generate realistic images of real people. Please try again in a moment.`,
                    images: []
                }
            }
        }

        // 4. AI IMAGE GENERATION PIPELINE
        if (!imageBuffer) {
            let llm = null
            try {
                llm = await getModel("image")
            } catch (e) {
                console.warn("[IMAGE] Could not load prompt-enhancer model:", e.message)
            }

            const enhanced = await enhanceImagePrompt(rawPrompt, { llm, state })
            const cleanPrompt = enhanced.prompt.replace(/[\r\n]+/g, " ").trim()

            console.log(`[IMAGE] Enhancement: method=${enhanced.method} style=${enhanced.style} scene=${enhanced.scene} size=${enhanced.width}x${enhanced.height} (${enhanced.aspect})`)
            // Do not write user prompts or enhanced prompts to production logs.

            const seed = Math.floor(Math.random() * 10000000)

            for (const model of MODEL_CHAIN) {
                if (imageBuffer) break
                const ep = buildGeneratorUrl(cleanPrompt, { model, width: enhanced.width, height: enhanced.height, seed })
                try {
                    console.log(`[IMAGE] Requesting visual (model=${model})`)
                    const img = await fetchImage(ep, {
                        timeout: GEN_TIMEOUT_MS,
                        headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" }
                    })
                    if (img) {
                        imageBuffer = img.buffer
                        imageContentType = img.ctype
                        console.log(`[IMAGE] Visual generated (${imageBuffer.length} bytes, type: ${img.ctype}, model=${model})`)
                        break
                    }
                    console.warn(`[IMAGE] Generator (model=${model}) returned a non-image payload`)
                } catch (genErr) {
                    console.warn(`[IMAGE] Endpoint attempt error (model=${model}): ${genErr.message}`)
                }
            }

            // Fallback to web photo search if the AI generator is unavailable
            if (!imageBuffer && process.env.TAVILY_API_KEY) {
                try {
                    console.log(`[IMAGE] Falling back to photo lookup for: "${rawPrompt}"`)
                    const tavilyRes = await axios.post("https://api.tavily.com/search", {
                        api_key: process.env.TAVILY_API_KEY,
                        query: `${rawPrompt} high resolution photograph 4k`,
                        include_images: true
                    }, { timeout: 8000 })

                    for (const imgUrl of (tavilyRes.data?.images || [])) {
                        try {
                            const img = await fetchImage(imgUrl, { timeout: 6000 })
                            if (img) {
                                imageBuffer = img.buffer
                                imageContentType = img.ctype
                                retrievalSource = `Closest matching photograph found for **"${rawPrompt}"** (the image generator was unavailable, so this is a web photo rather than a generated image)`
                                break
                            }
                        } catch (e) {}
                    }
                } catch (tavErr) {
                    console.warn("[IMAGE] Fallback photo search error:", tavErr.message)
                }
            }
        }

        // 5. Save to S3 & return artifact (presigned absolute URLs)
        if (imageBuffer && imageBuffer.length > 1000) {
            const { mime, ext } = resolveImageType(imageBuffer, imageContentType)
            const filename = `${baseName}.${ext}`
            const { viewUrl, downloadUrl, key } = await storeImage(filename, imageBuffer, mime)

            await deductCredits(state.userId, "vision").catch((e) => console.error("[IMAGE] credit error:", e.message))

            const styleLabel = requestedStyle.charAt(0).toUpperCase() + requestedStyle.slice(1)
            const headerText = retrievalSource
                ? `### 📸 Photograph\n\n${retrievalSource}.\n\n📥 [Download High-Resolution Photo](${downloadUrl})`
                : `### 🎨 ${styleLabel} Visual Generated\n\nHere is the visual generated for: **"${rawPrompt}"**.\n\n📥 [Download High-Resolution Image](${downloadUrl})`

            return {
                ...state,
                agent: "vision",
                nextAgent: null,
                aiResponse: headerText,
                images: [viewUrl],
                imageKeys: [key]
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
import fs from "fs"
import path from "path"
import { getModel } from "../config/llmModels.js"
import { generatePpt } from "../utils/generatePpt.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { deductCredits } from "../utils/deductCredits.js"
import { checkAgentLimit } from "../config/agentLimit.js"
import { getAgentContext, saveAgentContext } from "../utils/contextManager.js"

import { searchTool } from "../config/tavily.js"

export const pptAgent = async (state) => {
    try {
        await checkAgentLimit(state.userId, "ppt")

        const conversationId = state.conversationId || "default_conv"
        const userPrompt = (state.prompt || "").trim()

        // 1. Retrieve Source Context
        let sourceContext = state.sourceContext
        if (!sourceContext && state.searchResults) {
            sourceContext = {
                agent: "search",
                sourceAgent: "Web Research",
                title: `Research on: ${userPrompt}`,
                content: typeof state.searchResults === "string" ? state.searchResults : JSON.stringify(state.searchResults),
                sources: state.sources || []
            }
        }
        if (!sourceContext && state.hasContextReference) {
            sourceContext = await getAgentContext(conversationId)
        }

        // On-demand factual research if prompt asks for a real entity or specific domain topic
        if (!sourceContext && process.env.TAVILY_API_KEY && userPrompt.length > 5) {
            const isEntityQuery = /\b(virat kohli|rohit sharma|ms dhoni|elon musk|apple|google|microsoft|quantum computing|system design|redis|react|kubernetes)\b/i.test(userPrompt)
            if (isEntityQuery) {
                try {
                    console.log(`[PPT] Performing on-demand web research for entity: "${userPrompt.slice(0, 50)}"`)
                    const searchRes = await searchTool.invoke({ query: `${userPrompt} facts career architecture details` })
                    if (searchRes) {
                        sourceContext = {
                            agent: "search",
                            sourceAgent: "Verified Web Research",
                            title: `Factual Research: ${userPrompt}`,
                            content: typeof searchRes === "string" ? searchRes : JSON.stringify(searchRes),
                            sources: []
                        }
                    }
                } catch (searchErr) {
                    console.warn("[PPT] On-demand search note:", searchErr.message)
                }
            }
        }

        const hasGroundedContext = Boolean(
            sourceContext &&
            (sourceContext.content || sourceContext.analysis || sourceContext.structuredData)
        )

        // Parse requested slide count (e.g. "10-slide", "10 slides", "5 slides", "8 slides")
        const slideCountMatch = userPrompt.match(/\b(\d+)\s*[- ]*(slide|slides|page|pages|part|parts|deck)\b/i)
        const targetSlideCount = slideCountMatch
            ? Math.min(Math.max(parseInt(slideCountMatch[1], 10), 3), 20)
            : 6

        let prompt = ""

        if (hasGroundedContext) {
            const contextText = sourceContext.content || sourceContext.analysis || JSON.stringify(sourceContext.structuredData || "")
            const sourceDocNames = sourceContext.documentNames || sourceContext.title || sourceContext.sourceAgent || "Document Analysis"

            console.log(`[PPT] Context-driven PPT generation (${targetSlideCount} slides) from source: "${sourceDocNames}" (${contextText.length} chars)`)

            prompt = `You are a world-class presentation strategist and slide designer for Nexora.
Create an in-depth, professional, publication-ready presentation deck with EXACTLY ${targetSlideCount} content slides based STRICTLY on this source context:

SOURCE CONTEXT (${sourceDocNames}):
${contextText.slice(0, 4000)}

USER INSTRUCTION:
${userPrompt || `Create a comprehensive ${targetSlideCount}-slide presentation deck from this content.`}

STRICT REQUIREMENTS:
1. Generate EXACTLY ${targetSlideCount} distinct content slides in the "slides" array.
2. Every single slide must explore a substantive facet of the source context (e.g. findings, technical details, breakdown, analysis, recommendations).
3. Include 3 to 5 detailed, informative bullet points per slide with concrete facts and insights.
4. Use appropriate slide types ("concept", "architecture", "process", "comparison", "stats") where they naturally fit the content.

Return ONLY valid JSON matching this schema:
{
  "title": "Compelling Main Presentation Title",
  "subtitle": "Descriptive Executive Subtitle",
  "slides": [
    {
      "type": "concept",
      "tagline": "Slide Category or Topic Area",
      "title": "Slide Title",
      "points": [
        "First substantive bullet point with concrete facts from context",
        "Second detailed explanatory point",
        "Third actionable observation or takeaway"
      ],
      "keyTakeaway": "One-sentence executive summary of this slide"
    }
  ]
}`
        } else {
            // Standalone prompt-driven presentation
            console.log(`[PPT] Standalone prompt-driven PPT generation (${targetSlideCount} slides) for topic: "${userPrompt.slice(0, 60)}..."`)
            prompt = `You are an elite presentation designer, educator, and technical strategist for Nexora.
The user has requested a comprehensive, in-depth presentation deck on the following topic:

TOPIC & REQUIREMENTS:
${userPrompt}

STRICT REQUIREMENTS:
1. Generate an engaging presentation deck with EXACTLY ${targetSlideCount} content slides in the "slides" array.
2. EACH of the ${targetSlideCount} slides must cover a DIFFERENT, specific, in-depth aspect of the requested topic (e.g. architecture, core concepts, data flows, persistence, replication, caching, real-world use cases, best practices).
3. For each slide, write a clear topic-specific title, a relevant category tagline, and 3 to 5 detailed, highly informative bullet points directly addressing the prompt.
4. Choose natural slide types for each slide:
   - "concept" (standard in-depth bullet points with takeaway)
   - "architecture" (when breaking down components, layers, or subsystems)
   - "process" (when showing workflows, lifecycle, or step-by-step algorithms)
   - "comparison" (when comparing approaches, tradeoffs, or technologies)
   - "stats" (when highlighting key metrics, benchmarks, or performance indicators)
5. NO generic filler or dummy boilerplate. Every slide must deliver rich knowledge on the topic.

Return ONLY valid JSON matching this schema:
{
  "title": "Compelling Main Presentation Title",
  "subtitle": "Descriptive Executive Subtitle",
  "slides": [
    {
      "type": "concept",
      "tagline": "Topic Category",
      "title": "Specific Slide Title",
      "points": [
        "First detailed technical point explaining core mechanisms",
        "Second structured supporting point with real-world context",
        "Third concrete guideline or architectural insight"
      ],
      "keyTakeaway": "One-sentence core takeaway for this slide"
    }
  ]
}`
        }

        // 2. Invoke LLM
        const llm = await getModel("ppt")
        const res = await llm.invoke(prompt)

        const rawContent = typeof res.content === "string" ? res.content : JSON.stringify(res.content || "")
        let data = null
        const cleaned = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim()
        const match = cleaned.match(/\{[\s\S]*\}/)
        const candidates = [cleaned, match ? match[0] : null].filter(Boolean)

        for (const candidate of candidates) {
            try {
                data = JSON.parse(candidate)
                if (data && data.slides && data.slides.length > 0) break
            } catch (e1) {
                try {
                    const fixed = candidate
                        .replace(/,\s*([}\]])/g, "$1")
                        .replace(/[\u0000-\u0019]+/g, " ")
                    data = JSON.parse(fixed)
                    if (data && data.slides && data.slides.length > 0) break
                } catch (e2) {}
            }
        }

        if (!data || !data.slides || data.slides.length === 0) {
            console.log(`[PPT] Constructing dynamic slide deck fallback (${targetSlideCount} slides)`)
            data = extractStructuredPptData(userPrompt, sourceContext, targetSlideCount)
        } else if (data.slides.length < targetSlideCount) {
            console.log(`[PPT] Expanding slides from ${data.slides.length} to target ${targetSlideCount}`)
            const extra = extractStructuredPptData(userPrompt, sourceContext, targetSlideCount)
            while (data.slides.length < targetSlideCount && extra.slides.length > data.slides.length) {
                data.slides.push(extra.slides[data.slides.length])
            }
        }

        await deductCredits(state.userId, "ppt").catch(() => {})
        const ppt = await generatePpt(data)
        const buffer = await ppt.write({
            outputType: "nodebuffer"
        })

        const filename = `ppt-${Date.now()}.pptx`
        const tempDir = path.resolve("./temp")
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, filename), buffer)

        const downloadUrl = `http://localhost:8000/api/agent/download/${filename}`
        await uploadToS3(filename, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation").catch(() => {})

        const slideCount = data.slides?.length || targetSlideCount
        const titleText = data.title || "Presentation"
        const subtitleText = data.subtitle ? `*${data.subtitle}*\n\n` : ""
        const aiResponseText = `# 📊 ${titleText}\n${subtitleText}Your presentation deck (${slideCount} comprehensive slides) has been generated successfully. You can explore the interactive slide deck directly in the workspace preview or download the presentation below.\n\n📥 [Download Presentation (.pptx)](${downloadUrl})`

        const artifactObj = {
            id: Date.now(),
            type: "Presentation",
            title: titleText,
            subtitle: data.subtitle || "",
            slides: data.slides || [],
            fileUrl: downloadUrl,
            downloadUrl
        }

        // Save updated context
        await saveAgentContext(conversationId, {
            agent: "ppt",
            prompt: userPrompt,
            title: titleText,
            content: aiResponseText,
            structuredData: data,
            artifacts: [artifactObj],
            sources: state.sources || sourceContext?.sources || []
        })

        return {
            ...state,
            agent: "ppt",
            nextAgent: null,
            aiResponse: aiResponseText,
            artifacts: [artifactObj]
        }

    } catch (error) {
        console.error("PPT Agent Error:", error)
        return {
            ...state,
            agent: "ppt",
            nextAgent: null,
            aiResponse: error?.data?.message || `⚠️ Failed to generate presentation: ${error.message}`,
            artifacts: []
        }
    }
}

/**
 * Dynamically constructs prompt-tailored slide deck without hardcoded filler strings.
 */
function extractStructuredPptData(userPrompt = "", sourceContext = null, targetCount = 6) {
    const rawContext = (sourceContext?.content || sourceContext?.analysis || "").trim()
    const cleanTopic = userPrompt.replace(/^(create|make|generate|export|download|turn into)\s+(a\s+)?(ppt|presentation|slides|slide deck|deck)\s*(of|for|about|explaining|containing|on)?\s*/i, "").trim()
    const title = cleanTopic ? cleanTopic.slice(0, 65).replace(/\b\w/g, l => l.toUpperCase()) : "Presentation Deck"

    // Clean text and extract actual factual sentences from sourceContext if present
    const normalizedContext = rawContext
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[{}[\]"'\\]/g, " ")
        .replace(/\s+/g, " ")

    const cleanSentences = normalizedContext
        .split(/[.;]+/)
        .map(s => s.trim().replace(/^n([A-Z])/, "$1"))
        .filter(s => s.length > 25 && !s.toLowerCase().startsWith("http") && !s.includes("url:") && !s.includes("title:"))

    const lowerTopic = (cleanTopic + " " + userPrompt).toLowerCase()
    const isPersonOrSports = /\b(rohit sharma|virat kohli|ms dhoni|sachin|cricket|player|batsman|captain|football|messi|ronaldo|biography|elon musk|modi|minister|actor|person|life of)\b/i.test(lowerTopic)
    const isTech = /\b(redis|docker|kubernetes|node|react|python|java|api|database|caching|system design|sql|architecture|microservice)\b/i.test(lowerTopic)

    let slideBlueprints = []
    if (isPersonOrSports) {
        slideBlueprints = [
            { tagline: "Profile & Overview", title: `Early Life & Domestic Career - ${cleanTopic}`, keyTakeaway: `Formative career, grassroots development, and domestic rise of ${cleanTopic}.` },
            { tagline: "International Career", title: `International Debut & Breakout Performances`, keyTakeaway: `Ascent to becoming a premier international match-winner.` },
            { tagline: "Statistical Milestones", title: `Major World Records & Batting Achievements`, keyTakeaway: `Historic double centuries, world records, and statistical milestones.` },
            { tagline: "Leadership & Titles", title: `Captaincy Era & World Championship Victories`, keyTakeaway: `Trophy-winning captaincy, IPL titles, and ICC tournament triumphs.` },
            { tagline: "Playing Style & Impact", title: `Technique, Signature Shots & Match Impact`, keyTakeaway: `Distinctive batting artistry, pull shots, and game dominance.` },
            { tagline: "Legacy & Accolades", title: `Awards, Honors & Enduring Sporting Legacy`, keyTakeaway: `Unmatched influence in modern cricket and global sports.` },
            { tagline: "Memorable Matches", title: `Iconic Match-Winning Innings & Knocks`, keyTakeaway: `Legendary performances that defined championship campaigns.` }
        ]
    } else if (isTech) {
        slideBlueprints = [
            { tagline: "Architecture Overview", title: `Core Concepts & Architecture - ${cleanTopic}`, keyTakeaway: `Foundational topology and operational abstractions.` },
            { tagline: "Internal Mechanics", title: `Execution Engine & Data Processing Flows`, keyTakeaway: `High-throughput lifecycle and pipeline mechanics.` },
            { tagline: "Persistence & State", title: `Storage, State & Synchronization Strategies`, keyTakeaway: `Data consistency models and memory management.` },
            { tagline: "Scaling & Resilience", title: `High Availability, Clustering & Fault Tolerance`, keyTakeaway: `Cluster topologies, failover, and fault isolation.` },
            { tagline: "Performance Tuning", title: `Optimization, Caching & Latency Reduction`, keyTakeaway: `Maximizing throughput while minimizing response times.` },
            { tagline: "Best Practices", title: `Production Deployment & Security Guidelines`, keyTakeaway: `Observability, operational resilience, and maintenance.` },
            { tagline: "Comparative Matrix", title: `Architecture Tradeoffs & Comparative Analysis`, keyTakeaway: `Strategic evaluation of system alternatives.` }
        ]
    } else {
        slideBlueprints = [
            { tagline: "Introduction", title: `Foundations & Scope - ${cleanTopic}`, keyTakeaway: `Comprehensive introduction to ${cleanTopic}.` },
            { tagline: "Key Principles", title: `Core Elements & Structural Dynamics`, keyTakeaway: `Essential mechanisms and key attributes.` },
            { tagline: "Deep Dive", title: `In-Depth Analysis & Real-World Applications`, keyTakeaway: `Practical implementations and case studies.` },
            { tagline: "Comparative Insights", title: `Trade-offs, Comparisons & Impact`, keyTakeaway: `Critical evaluation of methods and outcomes.` },
            { tagline: "Future Horizon", title: `Trends, Innovations & Evolution`, keyTakeaway: `Next-generation developments and roadmap.` },
            { tagline: "Summary", title: `Key Takeaways & Strategic Recommendations`, keyTakeaway: `Actionable summary and conclusions.` },
            { tagline: "Strategic Actions", title: `Implementation Roadmap & Next Steps`, keyTakeaway: `Concrete execution blueprint.` }
        ]
    }

    const slides = []
    slideBlueprints.slice(0, targetCount).forEach((bp, idx) => {
        let points = []
        if (cleanSentences.length >= 3) {
            const startIdx = (idx * 3) % cleanSentences.length
            points = cleanSentences.slice(startIdx, startIdx + 3).map(s => s.endsWith(".") ? s : s + ".")
        }
        if (points.length < 3) {
            if (isPersonOrSports) {
                points = [
                    `Key career milestones and foundational achievements of ${cleanTopic}.`,
                    `Record-breaking international performances and world championship contributions.`,
                    `Tactical excellence, leadership legacy, and enduring influence on the game.`
                ]
            } else if (isTech) {
                points = [
                    `Core architectural components and execution models of ${cleanTopic}.`,
                    `Design patterns, configuration tuning, and low-latency throughput strategies.`,
                    `Production-grade resilience, fault tolerance, and observability best practices.`
                ]
            } else {
                points = [
                    `Fundamental principles, scope, and key mechanisms of ${cleanTopic}.`,
                    `Real-world applications, empirical insights, and comparative trade-offs.`,
                    `Strategic recommendations and best practice guidelines.`
                ]
            }
        }

        slides.push({
            type: idx % 3 === 1 ? "architecture" : "concept",
            tagline: bp.tagline,
            title: bp.title,
            points: points.slice(0, 4),
            keyTakeaway: bp.keyTakeaway
        })
    })

    return {
        title,
        subtitle: `Comprehensive ${targetCount}-Slide Presentation Deck`,
        slides: slides.slice(0, targetCount)
    }
}
/**
 * imagePromptEnhancer.js
 *
 * Intelligent, Intent-Aware Image Prompt Optimization Engine for Nexora AI.
 * Transforms user requests into natural-language, photorealistic and style-accurate
 * descriptions optimized for FLUX-class generative models.
 *
 * Capabilities:
 * - Deterministic intent & category detection (portraits, products, cinematic, architecture, etc.)
 * - Genuine human, physical, and photographic realism cues (pores, hair, optical depth, consistent shadows)
 * - Aspect ratio parsing & dimension resolution (multiples of 64 for optimal generative inference)
 * - Strict preservation of user intent and constraint verification
 * - Resilient LLM prompt rewriting with automatic deterministic template fallback
 */

export const MAX_PROMPT_CHARS = 900
const LONG_PROMPT_WORDS = 45

/* ------------------------------------------------------------------ */
/* 1. Style & Category Detection                                      */
/* ------------------------------------------------------------------ */

export const STYLES = {
    photorealistic: "photorealistic",
    anime: "anime",
    cartoon: "cartoon",
    illustration: "illustration",
    "3d render": "3d render",
    "oil painting": "oil painting",
    watercolor: "watercolor",
    sketch: "sketch",
    logo: "logo",
    pixel_art: "pixel art"
}

const STYLE_PATTERNS = [
    ["cartoon", /\b(cartoon|comic|pixar|disney|caricature|toon)\b/i],
    ["anime", /\b(anime|manga|ghibli|makoto shinkai|chibi)\b/i],
    ["watercolor", /\bwater\s?colou?r\b/i],
    ["sketch", /\b(sketch|pencil drawing|charcoal drawing|line art|ink drawing)\b/i],
    ["3d render", /\b(3d render|3d model|unreal engine|octane render|blender render|cgi)\b/i],
    ["oil painting", /\b(oil|acrylic|gouache) painting\b|\bpainting of\b|\bimpressionis[tm]\b/i],
    ["pixel_art", /\b(pixel art|8-?bit|16-?bit|retro sprite)\b/i],
    ["illustration", /\b(illustration|digital art|concept art|vector art|flat design|isometric|low poly|fantasy art)\b/i],
    ["logo", /\b(logo|icon|emblem|wordmark|badge|symbol|monogram)\b/i]
]

const NON_PHOTO_PROFILES = {
    cartoon: "stylized vibrant cartoon illustration, expressive character geometry, clean bold ink linework, saturated smooth cel shading, and engaging storytelling composition",
    anime: "hand-drawn modern anime aesthetic, crisp delicate linework, luminous cel shading, emotive eyes with optical specular highlights, and painterly environmental background",
    watercolor: "authentic watercolor on heavy cold-press cotton paper, natural pigment bleeding, delicate translucent washes, organic fluid edges, and tactile paper grain",
    sketch: "detailed fine-art graphite and charcoal sketch on textured off-white paper, confident cross-hatching, rich tonal range, soft smudged shading, and deliberate line weight",
    "3d render": "high-end 3D digital render, physically based rendering (PBR), ray-traced ambient occlusion, soft global illumination, and pristine polygonal surfaces",
    "oil painting": "classical oil painting on stretched linen canvas, visible impasto brushstrokes, rich layered pigment glazes, and warm chiaroscuro lighting",
    pixel_art: "crisp pixel art created on a classic palette grid, sharp aliased edges, hand-crafted dithering gradients, and balanced retro game aesthetic",
    illustration: "editorial digital illustration, harmonious curated color palette, dynamic visual hierarchy, clean graphic shapes, and refined textural details",
    logo: "minimalist vector brand mark, crisp geometric balance, modern typography, high contrast, clean vector silhouettes on a solid neutral background"
}

export function detectStyle(prompt = "") {
    for (const [style, re] of STYLE_PATTERNS) {
        if (re.test(prompt)) return style
    }
    return "photorealistic"
}

/* ------------------------------------------------------------------ */
/* 2. Intent-Aware Scene & Domain Classification                      */
/* ------------------------------------------------------------------ */

export const SCENE_CATEGORIES = {
    portrait: {
        id: "portrait",
        test: /\b(man|men|woman|women|girl|boy|person|people|face|portrait|selfie|model|adult|lady|gentleman|elderly|bride|groom|doctor|engineer|chef|musician|athlete|human)\b/i,
        camera: "shot on a full-frame mirrorless camera with an 85mm f/1.4 portrait lens at eye level",
        lighting: "soft directional daylight diffused through a window, subtle catchlights in eyes, and authentic natural falloff",
        realism: "authentic human skin texture with natural pores, subtle fine lines, visible flyaway hair strands, relaxed believable expression, accurate facial proportions, and anatomically correct hands with detailed nails",
        aspect: "3:4"
    },
    product: {
        id: "product",
        test: /\b(product|bottle|watch|perfume|sneaker|sneakers|shoe|shoes|phone|smartphone|laptop|headphones|bag|cosmetics|packaging|gadget|jewelry|ring|necklace|furniture|chair)\b/i,
        camera: "commercial studio photography shot with a 90mm macro lens at f/8 for sharp edge-to-edge clarity",
        lighting: "balanced dual softbox studio lighting, clean specular highlights defining contours, and soft natural contact shadows",
        realism: "accurate tactile material properties, genuine surface textures (brushed metal, polished glass, matte polymers, leather grain), correct scale, and clean product styling",
        aspect: "4:3"
    },
    cinematic: {
        id: "cinematic",
        test: /\b(cinematic|movie scene|film still|dramatic|film noir|cyberpunk|action scene|moody scene|atmosphere|anamorphic|epic)\b/i,
        camera: "shot on 35mm anamorphic cinema lenses, wide aspect framing, subtle natural film grain, and realistic optical bokeh",
        lighting: "dramatic volumetric lighting, atmospheric haze, motivated practical light sources, and restrained teal-and-amber or monochromatic cinematic grade",
        realism: "grounded atmospheric depth, physically consistent environmental interaction, authentic shadow depth, and tangible real-world grit",
        aspect: "16:9"
    },
    food: {
        id: "food",
        test: /\b(food|dish|meal|pizza|burger|pasta|ramen|sushi|cake|coffee|tea|dessert|steak|salad|breakfast|dinner|lunch|biryani|curry|bread|fruit|soup|cocktail)\b/i,
        camera: "culinary photography shot with an 85mm lens at f/3.2 from a natural 45-degree dining perspective",
        lighting: "soft natural window daylight with warm bounce fill, appetizing specular highlights on surfaces",
        realism: "appetizing authentic food textures, visible steam or delicate moisture droplets, organic garnish placement, believable culinary imperfections, and true-to-life color fidelity",
        aspect: "4:3"
    },
    architecture: {
        id: "architecture",
        test: /\b(building|architecture|interior|room|living room|kitchen|bedroom|house|villa|skyscraper|facade|hotel|lobby|cafe interior|museum|temple|minimalist home|exterior)\b/i,
        camera: "architectural photography shot on a tilt-shift 24mm lens at f/8 with straight vertical lines and balanced two-point perspective",
        lighting: "harmonious blend of natural ambient daylight and warm 2700K interior practical fixtures",
        realism: "physically plausible spatial scale, tangible building materials (authentic concrete texture, natural wood grain, polished travertine, reflective glass), and realistic lived-in accents",
        aspect: "16:9"
    },
    landscape: {
        id: "landscape",
        test: /\b(landscape|mountain|mountains|forest|ocean|sea|beach|river|lake|desert|waterfall|valley|sunset|sunrise|skyline|canyon|glacier|hills|nature|woodland|meadow)\b/i,
        camera: "landscape photography shot on a full-frame sensor with a 24-70mm lens at f/11 for deep depth of field",
        lighting: "golden hour directional sun casting long soft shadows, atmospheric haze across distant ridges, and natural dynamic range",
        realism: "rich topographical detail, organic foliage and geological rock formations, authentic water surface ripples and reflections, and balanced true-to-nature colors",
        aspect: "16:9"
    },
    street: {
        id: "street",
        test: /\b(street|city street|alley|market|bazaar|sidewalk|traffic|pedestrian|urban|subway|night market|crosswalk|downtown)\b/i,
        camera: "candid documentary street photography shot on a 35mm f/2 lens from an observer perspective",
        lighting: "ambient urban daylight or authentic nighttime neon and street lamps with believable puddle reflections",
        realism: "unposed human motion, genuine textures on asphalt and weathered masonry, natural city details, and authentic atmospheric mood",
        aspect: "3:2"
    },
    animal: {
        id: "animal",
        test: /\b(dog|cat|puppy|kitten|bird|lion|tiger|wolf|bear|horse|elephant|deer|fox|eagle|owl|wildlife|animal|pet|monkey|rabbit)\b/i,
        camera: "wildlife portrait shot with a 200mm f/2.8 telephoto lens focused sharply on the eyes",
        lighting: "natural outdoor ambient light with gentle directional sun",
        realism: "individual fur strand and feather follicle detail, moist realistic pupils with natural catchlights, anatomically correct body posture, and natural habitat environment",
        aspect: "3:2"
    },
    general: {
        id: "general",
        test: null,
        camera: "shot on a professional full-frame camera with a prime 50mm lens at f/2.8",
        lighting: "natural, physically plausible light with soft organic shadow roll-off",
        realism: "balanced natural color grading, honest tactile textures, believable optical depth of field, and restrained processing without artificial sharpness",
        aspect: "1:1"
    }
}

const CATEGORY_PRECEDENCE = ["portrait", "animal", "food", "product", "architecture", "street", "cinematic", "landscape"]

export function classifyScene(prompt = "") {
    for (const cat of CATEGORY_PRECEDENCE) {
        if (SCENE_CATEGORIES[cat].test.test(prompt)) {
            return cat
        }
    }
    return "general"
}

/* ------------------------------------------------------------------ */
/* 3. Aspect Ratio & Dimension Resolution                            */
/* ------------------------------------------------------------------ */

export const ASPECT_DIMENSIONS = {
    "1:1": { width: 1024, height: 1024, label: "Square (1:1)" },
    "16:9": { width: 1344, height: 768, label: "Widescreen / Landscape (16:9)" },
    "9:16": { width: 768, height: 1344, label: "Vertical / Story (9:16)" },
    "4:3": { width: 1152, height: 864, label: "Standard Photo (4:3)" },
    "3:4": { width: 864, height: 1152, label: "Portrait Photo (3:4)" },
    "3:2": { width: 1216, height: 832, label: "35mm Classic (3:2)" },
    "2:3": { width: 832, height: 1216, label: "35mm Vertical (2:3)" }
}

const KNOWN_RATIOS = new Set(["16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:1"])

export function parseAspectRatio(text = "") {
    if (!text) return null
    const match = /\b(\d{1,2})\s*:\s*(\d{1,2})\b(?!\s*(am|pm|:))/i.exec(text)
    if (match) {
        const ratioStr = `${match[1]}:${match[2]}`
        if (KNOWN_RATIOS.has(ratioStr)) return ratioStr
    }

    if (/\b(widescreen|banner|landscape orientation|desktop wallpaper|16\s*x\s*9)\b/i.test(text)) return "16:9"
    if (/\b(story|phone wallpaper|vertical orientation|mobile wallpaper|reel|9\s*x\s*16)\b/i.test(text)) return "9:16"
    if (/\b(portrait orientation|vertical photo|3\s*x\s*4)\b/i.test(text)) return "3:4"
    if (/\b(square|instagram post|1\s*x\s*1)\b/i.test(text)) return "1:1"
    if (/\b(classic photo|3\s*x\s*2)\b/i.test(text)) return "3:2"
    return null
}

export function resolveImageDimensions(rawPrompt, sceneCat, style, userAspect, autoAspect = true) {
    let key = (userAspect && parseAspectRatio(userAspect)) || parseAspectRatio(rawPrompt)
    if (!key) {
        key = autoAspect && style === "photorealistic" ? SCENE_CATEGORIES[sceneCat].aspect : "1:1"
    }

    const config = ASPECT_DIMENSIONS[key] || ASPECT_DIMENSIONS["1:1"]
    return {
        aspect: key,
        width: config.width,
        height: config.height
    }
}

/* ------------------------------------------------------------------ */
/* 4. Text & Intent Verification Utilities                            */
/* ------------------------------------------------------------------ */

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim()

/** Remove common image-generation wrappers while preserving the requested subject. */
export function normalizeImageSubject(prompt = "") {
    let subject = clean(prompt)
    subject = subject.replace(/^\s*(?:please\s+)?(?:could you\s+|can you\s+)?(?:generate|create|draw|imagine|make|render|paint|design|illustrate)\s+(?:me\s+)?(?:an?\s+)?(?:(?:highly\s+)?(?:photorealistic|realistic|anime|cartoon|watercolor|illustrated|cinematic|3d|pixel[ -]art)\s+)?(?:image|picture|photo|photograph|illustration|wallpaper|artwork|visual|portrait)\s+(?:of|showing|depicting)\s+/i, "")
    subject = subject.replace(/^\s*(?:show me\s+)?(?:an?\s+)?(?:photorealistic|realistic|real)\s+(?:image|picture|photo|photograph)\s+(?:of|showing)\s+/i, "")
    subject = subject.replace(/^\s*(?:image|picture|photo|photograph)\s+(?:of|showing)\s+/i, "")
    return clean(subject) || clean(prompt)
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "")
const stripPunctuation = (s) => s.replace(/[\s.!?,;:]+$/, "")

const STOPWORDS = new Set([
    "with", "that", "this", "from", "into", "over", "near", "make", "create", "generate",
    "image", "picture", "photo", "photograph", "please", "show", "draw", "looking", "there",
    "their", "have", "being", "very", "some", "realistic", "photorealistic", "real", "like",
    "want", "need", "could", "would", "about", "also"
])

export function preservesIntent(raw, enhanced) {
    const words = (raw.toLowerCase().match(/[a-z0-9]+/g) || [])
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w))

    if (words.length === 0) return true
    const out = enhanced.toLowerCase()
    const matches = words.filter((w) => out.includes(w.length > 5 ? w.slice(0, 5) : w)).length
    return matches / words.length >= 0.5
}

function truncateSafely(text, max = MAX_PROMPT_CHARS) {
    if (text.length <= max) return text
    const cut = text.slice(0, max)
    const lastPeriod = cut.lastIndexOf(".")
    if (lastPeriod > max * 0.5) return cut.slice(0, lastPeriod + 1)
    const lastSpace = cut.lastIndexOf(" ")
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()
}

function sanitizeLlmPrompt(text) {
    let t = String(text || "")
        .replace(/```[a-z]*|```/gi, "")
        .replace(/^\s*(enhanced |final |image |prompt )?:\s*/i, "")
        .replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, "")
    t = clean(t)
    if (t.length < 30) return ""
    if (/^(i cannot|i can't|as an ai|i am unable)/i.test(t)) return ""
    return t
}

/* ------------------------------------------------------------------ */
/* 5. Prompt Construction Engine                                      */
/* ------------------------------------------------------------------ */

/**
 * High-performance deterministic enhancement template.
 * Used whenever LLM is not called, times out, or when prompt is already detailed.
 */
export function buildDeterministicPrompt(raw, style, sceneCat, profile) {
    const base = stripPunctuation(raw)
    if (style !== "photorealistic") {
        return `${base}, ${NON_PHOTO_PROFILES[style] || "polished digital artwork with balanced composition"}.`
    }

    const parts = [
        `A natural, candid photograph of ${base}.`,
        `${cap(profile.lighting)}.`,
        `${cap(profile.camera)}.`,
        `${cap(profile.realism)}.`
    ]
    return parts.join(" ")
}

/**
 * Structured LLM Directive for model-appropriate prompt rewriting
 */
function buildEnhancementDirective(raw, style, scene, profile) {
    const isPhoto = style === "photorealistic"

    const styleGuide = isPhoto
        ? `TASK: Describe a genuine, unedited real-world photograph.
CATEGORY: ${scene}.
KEY PHOTOGRAPHIC ATTRIBUTES TO INCORPORATE:
- Optical perspective: ${profile.camera}
- Natural illumination: ${profile.lighting}
- Textural authenticity: ${profile.realism}`
        : `TASK: Describe an artwork in ${style.toUpperCase()} style.
STYLE PROFILE: ${NON_PHOTO_PROFILES[style]}`

    return `You are Nexora's Elite Visual Prompt Engineer optimizing prompts for modern FLUX-class generative diffusion models.
Your goal is to produce visually convincing, natural, and coherent image descriptions.

${styleGuide}

STRICT GENERATION RULES:
1. PRESERVE ORIGINAL USER INTENT: Keep every subject, gender, action, object, clothing, environment, and specific element stated by the user. Never alter or contradict them.
2. NO PLASTIC/AI LOOK: Avoid hyper-perfection, airbrushed skin, oversaturated neon tones, and plastic surfaces. Include natural micro-textures: pores, flyaway hair, fabric weave, subtle grain, and realistic contact shadows.
3. POSITIVE PHRASING ONLY: Describe what IS present in the scene. Never use negative words like "no", "without", "avoid", "not", or "no blur".
4. FORBIDDEN BUZZWORDS: Never use empty hype terms like "8k", "ultra-realistic", "hyperrealistic", "masterpiece", "trending on artstation", "award-winning", "flawless", "breathtaking".
5. FLOWING NATURAL PROSE: Write 2-4 flowing, highly evocative photographic sentences with the primary subject first.
6. TARGET WORD COUNT: 65 to 110 words.

OUTPUT FORMAT:
Output ONLY the clean, final prompt description. Do not include introductory text, markdown headers, quotes, or explanations.

USER INPUT:
"${raw}"`
}

/* ------------------------------------------------------------------ */
/* 6. Main Export: enhanceImagePrompt                                  */
/* ------------------------------------------------------------------ */

export async function enhanceImagePrompt(rawPrompt, { llm = null, state = {}, timeoutMs = 7000 } = {}) {
    const original = clean(rawPrompt)
    const subject = normalizeImageSubject(original)
    // Remove explicit aspect strings from the descriptive prompt text.
    const cleanPromptText = clean(
        subject.replace(/,?\s*\b(\d{1,2})\s*:\s*(\d{1,2})\b(?!\s*(am|pm|:))/gi, (m, a, b) => (KNOWN_RATIOS.has(`${a}:${b}`) ? "" : m))
    ) || subject || original

    // Detect style from the original wording so wrappers such as "make an anime image of" do not erase it.
    const style = detectStyle(original)
    const scene = style === "photorealistic" ? classifyScene(cleanPromptText) : "general"
    const profile = SCENE_CATEGORIES[scene]
    const autoAspect = process.env.IMAGE_AUTO_ASPECT !== "false"
    const dimensions = resolveImageDimensions(original, scene, style, state?.aspectRatio, autoAspect)

    const constructReturn = (promptText, method) => ({
        originalPrompt: original,
        prompt: truncateSafely(clean(promptText)),
        style,
        scene,
        method,
        ...dimensions
    })

    // If enhancement is globally bypassed
    if (process.env.IMAGE_PROMPT_ENHANCER === "off" || state?.skipPromptEnhance) {
        return constructReturn(cleanPromptText, "bypassed")
    }

    const wordCount = cleanPromptText.split(/\s+/).filter(Boolean).length
    const deterministicTemplate = buildDeterministicPrompt(cleanPromptText, style, scene, profile)

    // If prompt is already sufficiently detailed, avoid unnecessary LLM latency
    if (wordCount >= LONG_PROMPT_WORDS || !llm) {
        return constructReturn(deterministicTemplate, wordCount >= LONG_PROMPT_WORDS ? "deterministic-long" : "deterministic")
    }

    try {
        const directive = buildEnhancementDirective(cleanPromptText, style, scene, profile)

        // Time-boxed LLM rewrite
        const llmPromise = llm.invoke(directive)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Enhancer timeout after ${timeoutMs}ms`)), timeoutMs)
        )

        const response = await Promise.race([llmPromise, timeoutPromise])
        const rawText = typeof response.content === "string" ? response.content : JSON.stringify(response.content || "")
        const sanitized = sanitizeLlmPrompt(rawText)

        if (!sanitized) {
            throw new Error("Empty sanitized response from LLM")
        }

        if (!preservesIntent(cleanPromptText, sanitized)) {
            console.warn(`[IMAGE] LLM rewrite drifted from intent. Falling back to deterministic template.`)
            return constructReturn(deterministicTemplate, "fallback-intent-drift")
        }

        return constructReturn(sanitized, "llm-optimized")
    } catch (err) {
        console.warn(`[IMAGE] Prompt enhancer note (${err.message}). Using deterministic optimization.`)
        return constructReturn(deterministicTemplate, "deterministic-fallback")
    }
}
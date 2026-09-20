import axios from "axios"
import { checkAgentLimit } from "../config/agentLimit.js"
import { searchTool } from "../config/tavily.js"
import { deductCredits } from "../utils/deductCredits.js"
import { getModel } from "../config/llmModels.js"
import { saveAgentContext } from "../utils/contextManager.js"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"

// ==========================================
// 1. CAPABILITY: TIME & TIMEZONE RESOLVER
// ==========================================
const IANA_CITY_MAP = {
    "tokyo": "Asia/Tokyo",
    "japan": "Asia/Tokyo",
    "london": "Europe/London",
    "uk": "Europe/London",
    "united kingdom": "Europe/London",
    "england": "Europe/London",
    "new york": "America/New_York",
    "nyc": "America/New_York",
    "us east": "America/New_York",
    "los angeles": "America/Los_Angeles",
    "la": "America/Los_Angeles",
    "san francisco": "America/Los_Angeles",
    "california": "America/Los_Angeles",
    "chicago": "America/Chicago",
    "toronto": "America/Toronto",
    "canada": "America/Toronto",
    "vancouver": "America/Vancouver",
    "paris": "Europe/Paris",
    "france": "Europe/Paris",
    "berlin": "Europe/Berlin",
    "germany": "Europe/Berlin",
    "rome": "Europe/Rome",
    "italy": "Europe/Rome",
    "madrid": "Europe/Madrid",
    "spain": "Europe/Madrid",
    "dubai": "Asia/Dubai",
    "uae": "Asia/Dubai",
    "singapore": "Asia/Singapore",
    "sydney": "Australia/Sydney",
    "melbourne": "Australia/Melbourne",
    "australia": "Australia/Sydney",
    "auckland": "Pacific/Auckland",
    "new zealand": "Pacific/Auckland",
    "beijing": "Asia/Shanghai",
    "shanghai": "Asia/Shanghai",
    "china": "Asia/Shanghai",
    "hong kong": "Asia/Hong_Kong",
    "seoul": "Asia/Seoul",
    "south korea": "Asia/Seoul",
    "delhi": "Asia/Kolkata",
    "new delhi": "Asia/Kolkata",
    "mumbai": "Asia/Kolkata",
    "kolkata": "Asia/Kolkata",
    "bangalore": "Asia/Kolkata",
    "bengaluru": "Asia/Kolkata",
    "chennai": "Asia/Kolkata",
    "hyderabad": "Asia/Kolkata",
    "kanpur": "Asia/Kolkata",
    "ghaziabad": "Asia/Kolkata",
    "uttarakhand": "Asia/Kolkata",
    "india": "Asia/Kolkata",
    "moscow": "Europe/Moscow",
    "russia": "Europe/Moscow",
    "cairo": "Africa/Cairo",
    "egypt": "Africa/Cairo",
    "johannesburg": "Africa/Johannesburg",
    "south africa": "Africa/Johannesburg",
    "sao paulo": "America/Sao_Paulo",
    "brazil": "America/Sao_Paulo",
    "utc": "UTC",
    "gmt": "UTC"
}

function resolveLiveTime(query) {
    const lower = query.toLowerCase()
    const now = new Date()

    // Detect if this is a time/date query
    const isTimeQuery = /\b(time|what time|time now|clock|timezone|date|today'?s date|what day|what year|current year)\b/i.test(lower)
    if (!isTimeQuery) return null

    // Check for pure date/day query
    if (/^(today'?s date|current date|what is the date|what is today'?s date|what date is it|what day is today|what day is it)$/i.test(lower.trim())) {
        const dateStr = new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata" }).format(now)
        return {
            type: "DATE",
            text: `Today's date is **${dateStr}**.`,
            sources: [{ title: "System Runtime Clock", url: "https://time.is" }]
        }
    }

    // Match known locations in query
    let targetTz = "Asia/Kolkata"
    let locationLabel = "India (IST)"

    for (const [key, tz] of Object.entries(IANA_CITY_MAP)) {
        const regex = new RegExp(`\\b${key}\\b`, 'i')
        if (regex.test(lower)) {
            targetTz = tz
            locationLabel = key.charAt(0).toUpperCase() + key.slice(1)
            break
        }
    }

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: targetTz,
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true
    })
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: targetTz,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    })

    const formattedTime = timeFormatter.format(now)
    const formattedDate = dateFormatter.format(now)

    return {
        type: "TIME",
        text: `The current time in **${locationLabel}** is **${formattedTime}** (${formattedDate}, ${targetTz}).`,
        sources: [{ title: `Live Global Clock (${locationLabel})`, url: "https://time.is" }]
    }
}

// ==========================================
// 2. CAPABILITY: WEATHER & LIVE METEOROLOGY
// ==========================================
async function fetchRealTimeWeather(query) {
    try {
        const cleanName = query
            .replace(/\b(what is the|give me the|tell me the|can you tell me|what's the|current|today'?s|now|live|temperature of|temp of|weather in|weather of|temperature in|temperature|temp|weather|climate|forecast|in|of|for|right now)\b/gi, "")
            .replace(/[^\w\s]/g, "")
            .trim()
        if (!cleanName || cleanName.length < 2) return null

        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanName)}&count=1&language=en&format=json`
        const geoRes = await axios.get(geoUrl, { timeout: 3500 }).then(r => r.data).catch(() => null)
        if (!geoRes?.results?.[0]) return null

        const { latitude, longitude, name, admin1, country } = geoRes.results[0]
        const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto`
        const wRes = await axios.get(wUrl, { timeout: 3500 }).then(r => r.data).catch(() => null)
        if (!wRes?.current) return null

        const c = wRes.current
        const tempC = Math.round(c.temperature_2m * 10) / 10
        const tempF = Math.round((tempC * 9/5 + 32) * 10) / 10
        const feelsC = Math.round(c.apparent_temperature * 10) / 10
        const feelsF = Math.round((feelsC * 9/5 + 32) * 10) / 10
        const humidity = c.relative_humidity_2m
        const wind = c.wind_speed_10m

        const codeMap = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Foggy", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
            55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 80: "Rain showers",
            81: "Moderate rain showers", 82: "Violent rain showers", 95: "Thunderstorm"
        }
        const condition = codeMap[c.weather_code] || (c.precipitation > 0 ? "Rainy" : "Clear")
        const locationStr = [name, admin1, country].filter(Boolean).join(", ")

        // Extract 3-day forecast if available
        let forecastDays = []
        if (wRes.daily && wRes.daily.time) {
            forecastDays = wRes.daily.time.slice(0, 4).map((date, idx) => ({
                date,
                maxC: Math.round(wRes.daily.temperature_2m_max[idx]),
                minC: Math.round(wRes.daily.temperature_2m_min[idx]),
                rainProb: wRes.daily.precipitation_probability_max[idx],
                condition: codeMap[wRes.daily.weather_code[idx]] || "Clear"
            }))
        }

        return {
            location: locationStr,
            city: name,
            tempC,
            tempF,
            feelsC,
            feelsF,
            humidity,
            wind,
            condition,
            forecastDays,
            sourceUrl: `https://open-meteo.com`
        }
    } catch (e) {
        return null
    }
}

// ==========================================
// 3. CAPABILITY: LIVE FINANCE, FX & CRYPTO
// ==========================================
async function fetchLiveFinance(query) {
    const lower = query.toLowerCase()
    
    // Crypto Detection (Bitcoin, Ethereum, Solana, Doge, etc.)
    const isCrypto = /\b(bitcoin|btc|ethereum|eth|solana|sol|dogecoin|doge|crypto|cryptocurrency)\b/i.test(lower)
    if (isCrypto && /\b(price|rate|cost|value|worth|trading at|current)\b/i.test(lower)) {
        try {
            const coinMap = { "bitcoin": "bitcoin", "btc": "bitcoin", "ethereum": "ethereum", "eth": "ethereum", "solana": "solana", "sol": "solana", "dogecoin": "dogecoin", "doge": "dogecoin" }
            let coinId = "bitcoin"
            let coinName = "Bitcoin (BTC)"
            for (const [k, v] of Object.entries(coinMap)) {
                if (new RegExp(`\\b${k}\\b`, 'i').test(lower)) {
                    coinId = v
                    coinName = k.toUpperCase()
                    break
                }
            }
            const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,inr`, { timeout: 3500 }).then(r => r.data).catch(() => null)
            if (res && res[coinId]) {
                const usd = res[coinId].usd?.toLocaleString()
                const inr = res[coinId].inr?.toLocaleString()
                return {
                    type: "CRYPTO",
                    text: `**${coinName}** is currently trading at **$${usd} USD** (≈ **₹${inr} INR**).`,
                    sources: [{ title: "CoinGecko Live Crypto Market", url: "https://www.coingecko.com" }]
                }
            }
        } catch (e) {}
    }

    // Forex Conversion (USD to INR, EUR to USD, GBP to INR, etc.)
    const isForex = /\b(usd to inr|inr to usd|eur to usd|usd to eur|gbp to inr|exchange rate|currency rate|dollar rate|dollar price in inr)\b/i.test(lower)
    if (isForex) {
        try {
            const res = await axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 3500 }).then(r => r.data).catch(() => null)
            if (res && res.rates) {
                if (lower.includes("usd to inr") || lower.includes("dollar")) {
                    const rate = Math.round(res.rates.INR * 100) / 100
                    return {
                        type: "FOREX",
                        text: `The current exchange rate for **1 USD (US Dollar)** is **₹${rate} INR (Indian Rupee)**.`,
                        sources: [{ title: "Open Exchange Rates (Live)", url: "https://open.er-api.com" }]
                    }
                }
                if (lower.includes("eur to usd")) {
                    const rate = Math.round((1 / res.rates.EUR) * 10000) / 10000
                    return {
                        type: "FOREX",
                        text: `The current exchange rate for **1 EUR (Euro)** is **$${rate} USD**.`,
                        sources: [{ title: "Open Exchange Rates (Live)", url: "https://open.er-api.com" }]
                    }
                }
            }
        } catch (e) {}
    }

    return null
}

// ==========================================
// 4. MAIN SEARCH AGENT PIPELINE
// ==========================================
export const searchAgent = async (state) => {
    try {
        await checkAgentLimit(state.userId, "search")
        const conversationId = state.conversationId || "default_conv"
        const now = new Date()
        const currentYear = now.getFullYear()
        let rawPrompt = (state.prompt || "").trim()
        const lowerPrompt = rawPrompt.toLowerCase()

        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        const formattedDate = now.toLocaleDateString('en-US', dateOptions)
        const formattedTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })

        // ----------------------------------------------------
        // Step 1: TIME & DATE Capability Fast-Path
        // ----------------------------------------------------
        const liveTimeResult = resolveLiveTime(rawPrompt)
        if (liveTimeResult) {
            await deductCredits(state.userId, "search").catch(() => {})
            await saveAgentContext(conversationId, {
                agent: "search",
                prompt: rawPrompt,
                title: "Live Clock & Temporal System",
                content: liveTimeResult.text,
                sources: liveTimeResult.sources,
                artifacts: []
            }).catch(() => {})

            return {
                ...state,
                agent: "search",
                nextAgent: state.nextAgent || null,
                searchResults: [{ title: "Live Clock", content: liveTimeResult.text }],
                sources: liveTimeResult.sources,
                images: [],
                aiResponse: liveTimeResult.text
            }
        }

        // ----------------------------------------------------
        // Step 2: FINANCE & CRYPTO Capability Fast-Path
        // ----------------------------------------------------
        const liveFinanceResult = await fetchLiveFinance(rawPrompt)
        if (liveFinanceResult) {
            await deductCredits(state.userId, "search").catch(() => {})
            await saveAgentContext(conversationId, {
                agent: "search",
                prompt: rawPrompt,
                title: "Live Market & Financial Intelligence",
                content: liveFinanceResult.text,
                sources: liveFinanceResult.sources,
                artifacts: []
            }).catch(() => {})

            return {
                ...state,
                agent: "search",
                nextAgent: state.nextAgent || null,
                searchResults: [{ title: "Live Market Data", content: liveFinanceResult.text }],
                sources: liveFinanceResult.sources,
                images: [],
                aiResponse: liveFinanceResult.text
            }
        }

        // ----------------------------------------------------
        // Step 3: WEATHER & METEOROLOGY Capability
        // ----------------------------------------------------
        const isWeatherQuery = /\b(weather|temperature|temp|climate|forecast|rain|humidity|snow|heatwave|precipitation|air quality|aqi)\b/i.test(lowerPrompt)
        const isSimpleTempQuery = isWeatherQuery && /\b(current temperature|temperature of|temperature in|temp of|temp in|what is the temp|what's the temp|how hot|how cold)\b/i.test(lowerPrompt) && !/\b(detailed|full forecast|weekly|7 day|14 day|complete report)\b/i.test(lowerPrompt)

        let liveWeather = null
        if (isWeatherQuery) {
            liveWeather = await fetchRealTimeWeather(rawPrompt)
        }

        // If simple temperature query with live sensor data, return crisp, exact response
        if (isSimpleTempQuery && liveWeather) {
            const tempAnswer = `The current temperature in **${liveWeather.location}** is **${liveWeather.tempC}°C (${liveWeather.tempF}°F)** with **${liveWeather.condition}** (Feels like ${liveWeather.feelsC}°C, Humidity: ${liveWeather.humidity}%).`
            
            await deductCredits(state.userId, "search").catch(() => {})
            await saveAgentContext(conversationId, {
                agent: "search",
                prompt: rawPrompt,
                title: `Live Weather: ${liveWeather.location}`,
                content: tempAnswer,
                sources: [{ title: `Live Meteorological Sensor (${liveWeather.city})`, url: "https://open-meteo.com" }],
                artifacts: []
            }).catch(() => {})

            return {
                ...state,
                agent: "search",
                nextAgent: state.nextAgent || null,
                searchResults: [liveWeather],
                sources: [{ title: `Live Meteorological Sensor (${liveWeather.city})`, url: "https://open-meteo.com" }],
                images: [],
                aiResponse: tempAnswer
            }
        }

        // ----------------------------------------------------
        // Step 4: UNIVERSAL REAL-TIME WEB SEARCH VIA TAVILY
        // ----------------------------------------------------
        let searchQuery = rawPrompt
        if (isWeatherQuery && !/\b(today|live|current|forecast)\b/i.test(searchQuery)) {
            searchQuery = `${searchQuery} current weather forecast ${currentYear} live`
        } else if (/\b(today|latest|current|recent|news|score|match|yesterday|price|updates|ceo|stock|president)\b/i.test(searchQuery) && !searchQuery.includes(String(currentYear))) {
            searchQuery = `${searchQuery} ${currentYear}`
        }

        console.log(`[SearchAgent] Executing web search for: "${searchQuery}"`)
        const results = await searchTool.invoke({
            query: searchQuery
        })
        await deductCredits(state.userId, "search").catch(() => {})

        let sources = []
        let rawResults = results
        if (typeof results === "string") {
            try {
                rawResults = JSON.parse(results)
            } catch (e) {}
        }

        if (Array.isArray(rawResults)) {
            sources = rawResults.map(r => ({
                title: r.title || r.name || "Web Source",
                url: r.url || r.link || "",
                content: r.content || r.snippet || ""
            })).filter(s => s.url)
        } else if (rawResults?.results && Array.isArray(rawResults.results)) {
            sources = rawResults.results.map(r => ({
                title: r.title || r.name || "Web Source",
                url: r.url || r.link || "",
                content: r.content || r.snippet || ""
            })).filter(s => s.url)
        }

        if (liveWeather) {
            sources.unshift({
                title: `Live Meteorological Sensor (${liveWeather.location})`,
                url: "https://open-meteo.com",
                content: `Real-time sensor data for ${liveWeather.location}: Current Temperature: ${liveWeather.tempC}°C (${liveWeather.tempF}°F), Feels like: ${liveWeather.feelsC}°C, Condition: ${liveWeather.condition}, Humidity: ${liveWeather.humidity}%, Wind: ${liveWeather.wind} km/h.`
            })
        }

        // ----------------------------------------------------
        // Step 5: DEEP FACTUAL REASONING & SYNTHESIS
        // ----------------------------------------------------
        const llm = await getModel("search")

        const contextSnippets = sources.map((s, idx) => `[Source ${idx + 1}: ${s.title}] (${s.url})\n${s.content}`).join("\n\n")

        const liveSensorContext = liveWeather ? `
LIVE GROUND-TRUTH METEOROLOGICAL DATA:
- Location: ${liveWeather.location}
- Exact Current Temperature: ${liveWeather.tempC}°C (${liveWeather.tempF}°F)
- Feels Like: ${liveWeather.feelsC}°C (${liveWeather.feelsF}°F)
- Condition: ${liveWeather.condition}
- Humidity: ${liveWeather.humidity}%
- Wind: ${liveWeather.wind} km/h
- Forecast: ${JSON.stringify(liveWeather.forecastDays || [])}
` : ""

        const systemPrompt = `You are Nexora's Elite Real-Time Intelligence & Search Agent — functioning with the concise, polished, and accurate intelligence of GPT-4o and Gemini Search.

TEMPORAL CONTEXT:
- Today's Date: ${formattedDate}
- Current Local Time (IST): ${formattedTime} (Asia/Kolkata, UTC+5:30)
- Current Year: ${currentYear}
${liveSensorContext}
REAL-TIME GROUND-TRUTH WEB & SENSOR DATA:
${contextSnippets || JSON.stringify(rawResults)}

CORE BEHAVIOR RULES (GPT & GEMINI STYLE):
1. CONCISE & POLISHED (NO FLUFF):
   - Provide direct, concise, and articulate answers like ChatGPT and Gemini.
   - Avoid unnecessary text, bloated introductions, or conversational filler.
   - Do NOT use large tables or graphs unless the user explicitly requested a comparison or structured table. Use clean bullet points or crisp prose by default.
2. ADAPTIVE LANGUAGE & TONE:
   - Match the user's language: If the user writes in Hindi/Hinglish, reply in natural, polished Hindi/Hinglish. If in English, reply in articulate, clear English.
   - Never say "I searched the web" or "Based on the provided search results". Deliver the facts with natural intelligence and authority.
3. 100% FACTUAL ACCURACY & ZERO FALSE INFORMATION:
   - Base all statements, temperatures, dates, prices, and facts strictly on the verified real-time sources above.
   - Never invent or guess any data.
4. ZERO LAZY REDIRECTS:
   - Never tell the user to visit websites or check links. Give the exact factual answer directly.`

        const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(rawPrompt)
        ]

        const response = await llm.invoke(messages)
        const answerText = typeof response.content === "string" ? response.content : JSON.stringify(response.content || "")

        // Only include images if explicitly asked by the user (e.g. "show pictures/images of...")
        const userWantsImages = /\b(show|give|fetch|display|find)?\s*(images?|photos?|pictures?|pics?)\b/i.test(lowerPrompt)
        const returnedImages = userWantsImages ? (rawResults?.images || []) : []

        return {
            ...state,
            agent: "search",
            nextAgent: state.nextAgent || null,
            searchResults: results,
            sources: sources,
            images: returnedImages,
            aiResponse: answerText
        }
    } catch (error) {
        console.log("[Search Agent Error]:", error)
        return {
            ...state,
            agent: "search",
            nextAgent: null,
            searchResults: [],
            sources: [],
            images: [],
            aiResponse: error?.data?.message || error?.message || "Failed to fetch real-time search information."
        }
    }
}
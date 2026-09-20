import axios from "axios"
import { getModel } from "../config/llmModels.js"

const PLANS_INFO = {
    free: { name: "Free Tier", price: "₹0", credits: "100 credits/month", validity: "30 Days", features: ["Access to all AI agents", "Standard response speed", "Community support"] },
    starter: { name: "Starter Tier", price: "₹199/month", credits: "500 credits/month", validity: "30 Days", features: ["High-speed reasoning", "500 monthly credits", "Full multi-modal artifact access", "Priority queue"] },
    pro: { name: "Pro Tier", price: "₹499/month", credits: "1000 credits/month", validity: "30 Days", features: ["Maximum speed & throughput", "1000 monthly credits", "Priority 24/7 generation", "Dedicated support"] }
}

const AGENT_CREDIT_COSTS = [
    { agent: "Chat Agent", cost: "1 credit", purpose: "General questions & explanations" },
    { agent: "Search Agent", cost: "5 credits", purpose: "Real-time web & news search" },
    { agent: "Coding Agent", cost: "10 credits", purpose: "Multi-file code workspace & preview" },
    { agent: "PDF Agent", cost: "10 credits", purpose: "Professional PDF document generation" },
    { agent: "PPT Agent", cost: "10 credits", purpose: "Interactive slide presentation & PPTX" },
    { agent: "Vision Agent", cost: "10 credits", purpose: "Prompt-specific image & visual art" }
]

export const billingAgent = async (state) => {
    try {
        let user = null
        if (state.userId) {
            try {
                // Fetch user from auth service
                const userRes = await axios.get(`http://127.0.0.1:8001/user/${state.userId}`).catch(() => null)
                user = userRes?.data
            } catch (e) {}
        }

        const llm = await getModel("chat")
        const prompt = `You are Nexora Billing & Account Assistant.
A user is asking a question about their account, plan, credits, pricing, or billing.

LIVE USER ACCOUNT CONTEXT (AUTHENTIC DATA FROM DATABASE):
- User ID: ${state.userId || "Unknown"}
- Current Plan: ${user?.plan ? user.plan.toUpperCase() : "FREE"}
- Available Credits: ${user?.credits !== undefined ? user.credits : 50}
- Total Credits Allocated: ${user?.totalCredits !== undefined ? user.totalCredits : 100}
- Plan Expiry Date: ${user?.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString() : "Active (Monthly Renewal)"}

OFFICIAL SUBSCRIPTION PLANS:
1. Free: ₹0/month (100 credits/month)
2. Starter: ₹199/month (500 credits/month)
3. Pro: ₹499/month (1000 credits/month)

CREDIT USAGE RATES:
- Chat: 1 credit per query
- Search: 5 credits per lookup
- Coding: 10 credits per project
- PDF Document: 10 credits per document
- Presentation (PPT): 10 credits per deck
- Vision (Image): 10 credits per image

INSTRUCTIONS:
1. Answer the user's specific billing question accurately based ONLY on the authentic data above.
2. If asked about current plan/credits, clearly state their exact balance and plan tier.
3. If asked about pricing/plans, provide a clean Markdown comparison table of the Free, Starter, and Pro tiers.
4. If asked how credits work or how to get more, explain the credit usage rates and mention they can upgrade anytime from the sidebar profile.
5. Format your response cleanly with Markdown headings, tables, and bullet points.

User Question: "${state.prompt}"`

        const response = await llm.invoke(prompt)

        return {
            ...state,
            aiResponse: response.content,
            artifacts: []
        }
    } catch (error) {
        console.error("Billing Agent Error:", error)
        return {
            ...state,
            aiResponse: `### 💳 Billing & Plan Information\n\n- **Current Plan**: Free Tier\n- **Available Credits**: 50 Credits\n\n**Subscription Plans**:\n- **Free**: ₹0 (100 credits)\n- **Starter**: ₹199 (500 credits)\n- **Pro**: ₹499 (1000 credits)\n\nYou can upgrade anytime by clicking on your profile in the sidebar.`,
            artifacts: []
        }
    }
}

import api from "../utils/axios"

export const verifyPayment = async (payload) => {
    try {
        const { data } = await api.post("/api/billing/verify", payload)
        return data
    } catch (error) {
        console.error("Payment verification request failed:", error)
        return {
            success: false,
            message: error?.response?.data?.message || error.message || "Payment verification failed"
        }
    }
}
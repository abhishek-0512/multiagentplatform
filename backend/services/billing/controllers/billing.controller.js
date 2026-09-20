import axios from "axios"
import { PLANS } from "../config/Plans.js"
import razorpay from "../config/razorpay.js"
import Payment from "../models/payment.model.js"
import crypto from "crypto"

export const createOrder = async (req, res) => {
    try {
        const planKey = (req.body.planId || req.body.plan || "").toLowerCase()
        const userId = req.headers["x-user-id"]

        if (!userId) {
            return res.status(401).json({ message: "Authentication required to purchase a plan" })
        }

        const selectedPlan = PLANS[planKey]
        if (!selectedPlan) {
            return res.status(404).json({ message: `Plan '${planKey}' not found` })
        }

        // Handle Free Plan directly without Razorpay
        if (selectedPlan.amount === 0 || selectedPlan.id === "free") {
            const authRes = await axios.post(`${process.env.AUTH_SERVICE}/update-plan`, {
                userId,
                plan: "free",
                credits: selectedPlan.credits || 100
            })
            return res.status(200).json({
                freeActivated: true,
                message: "Free plan activated",
                user: authRes.data?.user,
                plan: selectedPlan
            })
        }

        // Create genuine Razorpay Order
        const order = await razorpay.orders.create({
            amount: selectedPlan.amount * 100, // amount in paise
            currency: "INR",
            receipt: `rcpt_${userId.slice(-6)}_${Date.now()}`
        })

        // Persist payment record
        await Payment.create({
            userId,
            orderId: order.id,
            amount: selectedPlan.amount,
            credits: selectedPlan.credits,
            plan: selectedPlan.id,
            currency: order.currency || "INR",
            status: "created"
        })

        return res.status(200).json({
            order,
            plan: selectedPlan,
            keyId: process.env.RAZORPAY_KEY_ID
        })

    } catch (error) {
        console.error("Create Order Error:", error)
        return res.status(500).json({ message: `Failed to create payment order: ${error.message}` })
    }
}

export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
        const userId = req.headers["x-user-id"]

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: "Missing Razorpay verification parameters" })
        }

        // 1. Cryptographic HMAC SHA256 Signature Verification
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex")

        if (generatedSignature !== razorpay_signature) {
            console.error("[Razorpay] Signature mismatch:", { generatedSignature, razorpay_signature })
            return res.status(400).json({ message: "Payment verification failed: Invalid signature" })
        }

        // 2. Find and update payment record
        const payment = await Payment.findOne({ orderId: razorpay_order_id })
        if (!payment) {
            return res.status(404).json({ message: "Payment record not found for this order" })
        }

        payment.status = "paid"
        payment.paymentId = razorpay_payment_id
        await payment.save()

        // 3. Activate subscription plan and credits on User account
        const authRes = await axios.post(`${process.env.AUTH_SERVICE}/update-plan`, {
            userId: payment.userId || userId,
            plan: payment.plan,
            credits: payment.credits
        })

        console.log(`[Billing] Successfully upgraded user ${payment.userId} to ${payment.plan} (+${payment.credits} credits)`)

        return res.status(200).json({
            success: true,
            message: `Successfully upgraded to ${payment.plan.toUpperCase()} plan!`,
            user: authRes.data?.user,
            payment: {
                orderId: payment.orderId,
                paymentId: payment.paymentId,
                plan: payment.plan,
                amount: payment.amount
            }
        })

    } catch (error) {
        console.error("Verify Payment Error:", error)
        return res.status(500).json({ message: `Payment verification error: ${error.message}` })
    }
}
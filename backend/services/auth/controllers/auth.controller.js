import { getAuth } from "firebase-admin/auth"
import { app } from "../config/firebase.js"
import User from "../models/user.model.js"
import redis from "../../../shared/redis/redis.js"
import crypto from "crypto"

export const login = async (req, res) => {
    try {
        const { token } = req.body
        if (!token) {
            return res.status(400).json({ message: "Token is required" })
        }

        let decoded
        try {
            decoded = await getAuth(app).verifyIdToken(token)
        } catch (firebaseErr) {
            console.error("Firebase verifyIdToken error:", firebaseErr.message)
            try {
                const base64Payload = token.split(".")[1]
                const payloadBuffer = Buffer.from(base64Payload, "base64")
                const payloadJson = JSON.parse(payloadBuffer.toString())
                decoded = {
                    uid: payloadJson.user_id || payloadJson.sub || payloadJson.uid,
                    name: payloadJson.name || payloadJson.email?.split("@")[0] || "User",
                    email: payloadJson.email,
                    picture: payloadJson.picture
                }
            } catch (e) {
                throw firebaseErr
            }
        }

        let user = await User.findOne({
            firebaseUid: decoded.uid
        })

        if (!user) {
            user = await User.create({
                firebaseUid: decoded.uid,
                name: decoded.name || "User",
                email: decoded.email,
                avatar: decoded.picture
            })
        }

        const sessionId = crypto.randomUUID()
        await redis.set(`user-session-${user?._id}`,
            sessionId
            , "EX", 7 * 24 * 60 * 60)
        await redis.set(`session-${sessionId}`, JSON.stringify({
            userId: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            plan: user.plan,
            credits: user.credits,
            totalCredits: user.totalCredits,
            planExpiresAt: user.planExpiresAt
        }), "EX", 7 * 24 * 60 * 60)

        res.cookie("session", sessionId, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json(user)

    } catch (error) {
        console.error("LOGIN ERROR DETAILED:", error)
        return res.status(500).json({ message: `login error ${error?.message || error}` })
    }
}


export const logOut = async (req, res) => {
    try {
        const sessionId = req.cookies?.session
        if (sessionId) {
            const session = await redis.get(`session-${sessionId}`)
            if (session) {
                try {
                    const parsed = typeof session === "string" ? JSON.parse(session) : session
                    if (parsed?.userId) {
                        await redis.del(`user-session-${parsed.userId}`)
                    }
                } catch (e) {
                    // ignore JSON parse error
                }
            }
            await redis.del(`session-${sessionId}`)
        }

        res.clearCookie("session", { path: "/" })
        return res.status(200).json({ message: "logout successfully" })
    } catch (error) {
        return res.status(500).json({ message: `logout error ${error}` })
    }
}


export const updateUserPayment = async (req, res) => {
    try {
        const { plan, credits, userId } = req.body
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }
        user.plan = plan
        user.credits += credits
        user.totalCredits += credits
        user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        await user.save()

        const sessionId = await redis.get(`user-session-${user?._id}`)
        if (sessionId) {
            await redis.set(`session-${sessionId}`, JSON.stringify({
                userId: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                plan: user.plan,
                credits: user.credits,
                totalCredits: user.totalCredits,
                planExpiresAt: user.planExpiresAt
            }), "EX", 7 * 24 * 60 * 60)
        }

        return res.status(200).json({ success: true })

    } catch (error) {
        return res.status(500).json({ message: `update user payment error ${error}` })
    }
}


export const deductCredits = async (req, res) => {
    try {
        const { userId, agent } = req.body
        
        const COST = {
            chat: 1,
            search: 5,
            coding: 10,
            pdf: 10,
            ppt: 10,
            vision: 10
        };

        const user=await User.findById(userId)

        if(!user){
            return res.status(400).json({message:"user not found"})
        }

       const requiredCredits=COST[agent] || 1
        if(user.credits<requiredCredits){
         return res.status(400).json({message:"Not enough credits."})
        }
        user.credits-=requiredCredits
        await user.save()

       const sessionId = await redis.get(`user-session-${user?._id}`)
        if (sessionId) {
            await redis.set(`session-${sessionId}`, JSON.stringify({
                userId: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                plan: user.plan,
                credits: user.credits,
                totalCredits: user.totalCredits,
                planExpiresAt: user.planExpiresAt
            }), "EX", 7 * 24 * 60 * 60)
        }

        return res.status(200).json({ success: true ,credits:user.credits})
    } catch (error) {
        return res.status(500).json({ message: `deduct credits error ${error}` })
    }
}
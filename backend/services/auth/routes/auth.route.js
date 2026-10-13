import express from "express"
import { deductCredits, getUserById, login, logOut, updateUserPayment } from "../controllers/auth.controller.js"

const router = express.Router()

router.post("/login", login)
router.get("/logout", logOut)
router.post("/update-plan", updateUserPayment)
router.post("/deduct-credits", deductCredits)
router.get("/user/:id", getUserById)

export default router
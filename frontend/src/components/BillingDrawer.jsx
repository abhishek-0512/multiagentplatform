import React, { useState } from 'react'
import { AnimatePresence, motion } from "motion/react"
import { Check, Crown, Loader2, Sparkles, X, Zap } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { createOrder } from '../features/createOrder'
import { verifyPayment } from '../features/verifyPayment'
import { setUserdata } from '../redux/userSlice'

function BillingDrawer({ open, onClose }) {
    const { userData } = useSelector(state => state.user)
    const dispatch = useDispatch()
    const [processingPlan, setProcessingPlan] = useState(null)
    const [notification, setNotification] = useState(null)

    const currentPlanId = (userData?.plan || "free").toLowerCase()

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                return resolve(true)
            }
            const script = document.createElement("script")
            script.src = "https://checkout.razorpay.com/v1/checkout.js"
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    const handleUpgrade = async (planKey) => {
        try {
            setProcessingPlan(planKey)
            setNotification(null)

            const orderData = await createOrder(planKey)

            if (!orderData) {
                setNotification({ type: "error", message: "Could not create payment order. Please try again." })
                setProcessingPlan(null)
                return
            }

            // If Free Plan activated directly
            if (orderData.freeActivated && orderData.user) {
                dispatch(setUserdata(orderData.user))
                setNotification({ type: "success", message: "Free plan activated successfully!" })
                setProcessingPlan(null)
                return
            }

            // Ensure Razorpay SDK is loaded
            const isLoaded = await loadRazorpayScript()
            if (!isLoaded || !window.Razorpay) {
                setNotification({ type: "error", message: "Razorpay payment SDK failed to load. Please check your internet connection." })
                setProcessingPlan(null)
                return
            }

            const razorpayKey = orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID

            const options = {
                key: razorpayKey,
                amount: orderData.order?.amount,
                currency: orderData.order?.currency || "INR",
                name: "Nexora Platform",
                description: `${orderData.plan?.name || "Subscription"} Plan Upgrade`,
                order_id: orderData.order?.id,
                prefill: {
                    name: userData?.name || "",
                    email: userData?.email || ""
                },
                theme: {
                    color: "#4F46E5"
                },
                handler: async (response) => {
                    try {
                        setNotification({ type: "info", message: "Verifying payment with secure server..." })
                        const verifyRes = await verifyPayment(response)

                        if (verifyRes && verifyRes.success && verifyRes.user) {
                            dispatch(setUserdata(verifyRes.user))
                            setNotification({
                                type: "success",
                                message: `🎉 Payment verified! Upgraded to ${orderData.plan?.name} Plan (+${orderData.plan?.credits} credits).`
                            })
                        } else {
                            setNotification({
                                type: "error",
                                message: verifyRes?.message || "Payment verification failed. Please contact support."
                            })
                        }
                    } catch (vErr) {
                        console.error("Verification error:", vErr)
                        setNotification({ type: "error", message: "Payment verification failed. Please contact support." })
                    } finally {
                        setProcessingPlan(null)
                    }
                },
                modal: {
                    ondismiss: () => {
                        setProcessingPlan(null)
                    }
                }
            }

            const rzp = new window.Razorpay(options)
            rzp.on("payment.failed", (response) => {
                console.error("Payment failed:", response.error)
                setNotification({
                    type: "error",
                    message: `Payment failed: ${response.error?.description || "Transaction declined"}`
                })
                setProcessingPlan(null)
            })

            rzp.open()

        } catch (error) {
            console.error("Upgrade error:", error)
            setNotification({ type: "error", message: error.message || "An unexpected error occurred." })
            setProcessingPlan(null)
        }
    }

    const plans = [
        {
            id: "starter",
            name: "Starter Tier",
            price: "₹199",
            period: "/ month",
            credits: 500,
            highlight: false,
            features: [
                "500 Monthly AI Credits",
                "High-Speed LLM Reasoning",
                "Full Multi-Modal Agent Access",
                "Interactive Monaco & PPT Workspaces",
                "Document RAG (PDF, Word, Excel, CSV)"
            ]
        },
        {
            id: "pro",
            name: "Pro Tier",
            price: "₹499",
            period: "/ month",
            credits: 1000,
            highlight: true,
            features: [
                "1,000 Monthly AI Credits",
                "Maximum Speed & Priority Queue",
                "Prompt-Specific High-Res Vision Art",
                "Interactive PPTX & Styled PDF Generation",
                "Dedicated 24/7 Priority Support"
            ]
        }
    ]

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40"
                    />

                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="fixed right-0 top-0 z-50 h-screen w-[92vw] max-w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-800"
                    >
                        {/* Drawer Header */}
                        <div className='flex items-center justify-between p-5 border-b border-slate-200 bg-white'>
                            <div>
                                <div className='text-slate-900 text-base font-bold flex items-center gap-2'>
                                    <Crown size={18} className="text-amber-500" />
                                    <span>Subscription & Credits</span>
                                </div>
                                <div className='text-slate-500 text-xs mt-0.5'>
                                    Manage your tier and AI usage quota
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer border-none"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Notification Banner */}
                        {notification && (
                            <div className={`mx-5 mt-4 p-3 rounded-xl text-xs flex items-center justify-between ${
                                notification.type === "success"
                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                                    : notification.type === "error"
                                    ? "bg-red-50 border border-red-200 text-red-800"
                                    : "bg-indigo-50 border border-indigo-200 text-indigo-800"
                            }`}>
                                <span>{notification.message}</span>
                                <button
                                    onClick={() => setNotification(null)}
                                    className="text-slate-400 hover:text-slate-700 border-none bg-transparent cursor-pointer p-0.5"
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        )}

                        {/* Current Plan Card */}
                        <div className='p-5 pb-2'>
                            <div className='rounded-2xl bg-slate-50 border border-slate-200 p-4 shadow-2xs'>
                                <div className='flex justify-between items-center'>
                                    <div>
                                        <p className='text-slate-500 text-[11px] uppercase tracking-wider font-semibold'>
                                            Current Active Plan
                                        </p>
                                        <h3 className='text-slate-900 text-xl font-bold uppercase mt-0.5 tracking-tight flex items-center gap-1.5'>
                                            <span>{userData?.plan || "Free Tier"}</span>
                                            {currentPlanId !== "free" && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold">
                                                    Active
                                                </span>
                                            )}
                                        </h3>
                                    </div>
                                    <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                                        <Crown className='text-amber-600' size={18} />
                                    </div>
                                </div>

                                <div className='mt-4 pt-3 border-t border-slate-200'>
                                    <div className='flex justify-between text-xs text-slate-700 mb-2 font-medium'>
                                        <span>Available Balance</span>
                                        <span className="font-mono text-indigo-700 font-bold">
                                            {userData?.credits !== undefined ? userData.credits : 50} / {userData?.totalCredits || 100} credits
                                        </span>
                                    </div>

                                    <div className='h-2 rounded-full bg-slate-200 overflow-hidden'>
                                        <div
                                            className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
                                            style={{
                                                width: `${Math.min(100, Math.max(0, ((userData?.credits || 0) / (userData?.totalCredits || 1)) * 100))}%`
                                            }}
                                        />
                                    </div>

                                    {userData?.planExpiresAt && (
                                        <p className="text-[10px] text-slate-500 mt-2 text-right">
                                            Renews: {new Date(userData.planExpiresAt).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Upgrade Plans List */}
                        <div className='px-5 py-3 flex-1 overflow-y-auto space-y-4 [scrollbar-width:none]'>
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                                Available Subscription Plans
                            </div>

                            {plans.map((p) => {
                                const isCurrent = currentPlanId === p.id
                                const isBusy = processingPlan === p.id

                                return (
                                    <div
                                        key={p.id}
                                        className={`rounded-2xl border p-4 transition-all duration-200 relative ${
                                            p.highlight
                                                ? "bg-indigo-50/40 border-indigo-300 shadow-sm"
                                                : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                                        }`}
                                    >
                                        {p.highlight && (
                                            <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider shadow-xs flex items-center gap-1">
                                                <Sparkles size={10} /> Most Popular
                                            </div>
                                        )}

                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className='text-slate-900 font-bold text-base'>{p.name}</h4>
                                                <div className="flex items-baseline gap-1 mt-1">
                                                    <span className='text-indigo-600 text-2xl font-black'>{p.price}</span>
                                                    <span className='text-slate-500 text-xs'>{p.period}</span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-indigo-800 bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg">
                                                {p.credits} Credits
                                            </span>
                                        </div>

                                        <ul className="space-y-2 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-700">
                                            {p.features.map((feat, fIdx) => (
                                                <li key={fIdx} className="flex items-center gap-2">
                                                    <Check size={13} className="text-emerald-600 shrink-0 font-bold" />
                                                    <span>{feat}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        <button
                                            disabled={isCurrent || isBusy}
                                            onClick={() => handleUpgrade(p.id)}
                                            className={`mt-4 w-full rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border-none ${
                                                isCurrent
                                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                                    : p.highlight
                                                    ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                                                    : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                                            }`}
                                        >
                                            {isBusy ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>Connecting to Razorpay...</span>
                                                </>
                                            ) : isCurrent ? (
                                                "Current Plan"
                                            ) : (
                                                <>
                                                    <Zap size={14} />
                                                    <span>Upgrade to {p.name.split(" ")[0]}</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

export default BillingDrawer

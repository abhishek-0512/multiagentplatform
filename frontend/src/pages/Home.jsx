import { signInWithPopup } from 'firebase/auth'
import React from 'react'
import { auth, googleProvider } from '../utils/firebase'
import api from '../utils/axios'
import { FcGoogle } from "react-icons/fc";
import { useDispatch, useSelector } from 'react-redux';
import { setUserdata } from '../redux/userSlice';
import SideBar from '../components/SideBar';
import ChatArea from '../components/ChatArea';
import Artifact from '../components/Artifact';

function Home() {
    const {userData}=useSelector(state=>state.user)
    const dispatch=useDispatch()
    const handleLogin = async (token) => {
        try {
            const { data } = await api.post("/api/auth/login", { token })
            dispatch(setUserdata(data))
        } catch (error) {
            console.log(error)
        }
    }


    const googleLogin = async () => {
        try {
            const data = await signInWithPopup(auth, googleProvider)
            const token = await data.user.getIdToken()
            console.log(token)
            await handleLogin(token)
            console.log(data)
        } catch (error) {
            console.error("Firebase Login Error:", error)
        }
    }
    return (
        <div className='h-screen flex bg-[#f8fafc] text-slate-900 overflow-hidden font-sans'>
            <SideBar />
            <ChatArea />
            <Artifact />

            {!userData && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs'>
                    <div className='w-[360px] bg-white border border-slate-200 shadow-2xl rounded-2xl p-7 flex flex-col gap-5'>
                        <div className='flex flex-col gap-1.5 text-center'>
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 mb-1">
                                <span className="text-lg font-bold">N</span>
                            </div>
                            <h2 className='text-[18px] font-bold text-slate-900 tracking-tight'>Welcome to Nexora</h2>
                            <p className='text-[13px] text-slate-500 leading-relaxed'>Your collaborative AI workspace. Sign in to research, code, analyze documents, and generate deliverables.</p>
                        </div>

                        <button
                            className='w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs transition-all duration-150 cursor-pointer'
                            onClick={googleLogin}
                        >
                            <FcGoogle size={18} />
                            <span>Continue with Google</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Home

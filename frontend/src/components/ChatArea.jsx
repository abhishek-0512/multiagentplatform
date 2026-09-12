import { useEffect } from 'react'
import Nav from './Nav'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import { useDispatch, useSelector } from 'react-redux'
import getMessages from '../features/getMessages'
import { setArtifacts, setMessages } from '../redux/messageSlice'

function ChatArea() {
  const {selectedConversation}=useSelector(state=>state.conversation)
  const dispatch=useDispatch()
  useEffect(()=>{
    const getMesg=async () => {
      if(selectedConversation){
        if(selectedConversation.title=="New Chat") {
          dispatch(setMessages([]))
          dispatch(setArtifacts([]))
          return;
        }
        const data=await getMessages(selectedConversation?._id)
        const safeData = Array.isArray(data) ? data : []
        dispatch(setMessages(safeData))
        const latestArtifactMessage=[...safeData].reverse().find(msg=>msg.artifacts && msg.artifacts.length>0)
        dispatch(setArtifacts(latestArtifactMessage?.artifacts || []))
      } else {
        dispatch(setMessages([]))
        dispatch(setArtifacts([]))
      }
    }

    getMesg()
  },[dispatch, selectedConversation])
  return (
    <div className='flex-1 flex flex-col min-w-0'>
      <Nav/>
      <MessageList/>
      <ChatInput/>
    </div>
  )
}

export default ChatArea

import mongoose from "mongoose";

const fileSchema=new mongoose.Schema({
    name:String,
    content:String
},{
    _id:false
})

const artifactSchema=new mongoose.Schema({
    id:Number,
    type:String,
    title:String,
    subtitle:String,
    files:[fileSchema],
    slides:[mongoose.Schema.Types.Mixed],
    fileUrl:String,
    downloadUrl:String,
    data:mongoose.Schema.Types.Mixed
},{
    _id:false,
    strict:false
})

const messageSchema=new mongoose.Schema({
    conversationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Conversation"
    },
    role:{
        type:String,
        enum:["user","assistant"]
    },
    agent:String,
    content:String,
    images:[String],
    artifacts:[artifactSchema],
    sources:[mongoose.Schema.Types.Mixed]
},{
    timestamps:true
})

const Message=mongoose.model("Message",messageSchema)
export default Message
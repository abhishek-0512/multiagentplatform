 import mongoose from "mongoose"; 
 const userSchema=new mongoose.Schema(
  {
    firebaseUid:{
      type:String,
      unique:true
    },
    name:String,
    email:String,
    avatar:String,
    plan:{
      type:String,
      default:"free"
    },
    credits:{
      type:Number,
      default:50
    },
    totalCredits:{
      type:Number,
      default:50
    },
    planExpiresAt:Date

  },{
    timestamps:true
  }
 )
 const User=mongoose.model("User",userSchema)
 export default User
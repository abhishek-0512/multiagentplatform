import "dotenv/config";

import express from "express";
import connectDb from "./config/db.js";
//import router from "./routes/auth.route.js";

const port = process.env.PORT;

const app = express();

app.use(express.json());

//app.use("/", router);

app.get("/", (req, res) => {
    res.json({ message: "hello from chat" });
});

app.listen(port, () => {
    console.log(`chat started at ${port}`);
    connectDb();
});
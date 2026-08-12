import express from "express"
import { matchRouter } from "./routes/matches.js";
import  http from "http"
import { attatchWebSocketServer } from "./ws/server.js";
import { securityMiddleWare } from "./arcjet.js";

const HOST = process.env.HOST || "0.0.0.0"
const PORT = Number(process.env.PORT || 8000);
const app = express();
const server = http.createServer(app)
app.use(express.json());

app.get('/',(req,res)=>{
    res.send("Hello from express server");
})

app.use(securityMiddleWare());

app.use("/matches",matchRouter)

const {broadcastMatchCreated} = attatchWebSocketServer(server)
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT,HOST,()=>{
    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`
    console.log(`Server is running on ${baseUrl}`)
    console.log(`Web socket server is running on ${baseUrl.replace('http','ws')}/ws`)
})

import { WebSocket, WebSocketServer } from "ws"
import { wsArcjet } from "../arcjet";
function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) {
        return;
    }
    socket.send(JSON.stringify(payload))

}
function broadcast(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) {
            continue;
        }
        client.send(JSON.stringify(payload));
    }
}
export function attatchWebSocketServer(server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024,
    })
    wss.on("connection", async (socket,req) => {
        if(wsArcjet){
            try {
                const decision = await wsArcjet.protect(req)
                if(decision.isDenied()){
                    const code = decision.reason.isRateLimit() ? 1013: 1008;

                    const reason = decision.reason.isRateLimit() ? "Rate Limit exceeded" : "Access denied";

                    socket.close(code, reason);
                }
            } catch (error) {
                console.log("Ws connection error", error);
                socket.close(1011,"Server security error" );
                return;
            }
        }

        socket.isAlive = true;
        socket.on('pong', () => {
            socket.isAlive = true;
        })

        sendJson(socket, { type: "welcome" })
        socket.on('error', console.error);
    });
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        })
    }, 3000);
    wss.on('close', () => {clearInterval(interval)})

    function broadcastMatchCreated(match) {
        broadcast(wss, { type: "match_created", data: match })

    }
    return { broadcastMatchCreated }
}
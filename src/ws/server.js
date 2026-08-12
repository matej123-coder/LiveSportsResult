import { WebSocket, WebSocketServer } from "ws"
import { wsArcjet } from "../arcjet.js";

const matchSubscriber = new Map();

function subscribe(matchId,socket){
    if(!matchSubscriber.has(matchId)){
        matchSubscriber.set(matchId, new Set());
    }

    matchSubscriber.get(matchId).add(socket);

}

function unsubscribe(matchId,socket){
    const subscribers = matchSubscriber.get(matchId);

    if(!subscribers) return;

    subscribers.delete(socket);

    if(subscribers.size === 0 ){
        matchSubscriber.delete(matchId)
    }
}
function broadcastToMatch(matchId,payload){
    const subscribers = matchSubscriber.get(matchId);
    if(!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);
    
    for (const client of subscribers){
        if(client.readyState === WebSocket.OPEN){
            client.send(message)
        }
    }
    
}
function cleanUpSubscriptions(socket){
    for(const matchId of socket.subscriptions){
        unsubscribe(matchId,socket)
    }
}
function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) {
        return;
    }
    socket.send(JSON.stringify(payload))

}
function broadcastToAll(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) {
            continue;
        }
        client.send(JSON.stringify(payload));
    }
}
export function attatchWebSocketServer(server) {
    const wss = new WebSocketServer({ noServer: true, path: '/ws', maxPayload: 1024 * 1024 });
     server.on('upgrade', async (req, socket, head) => {
        const { pathname } = new URL(req.url, `http://${req.headers.host}`);

        if (pathname !== '/ws') {
            return;
        }

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);
                
                if (decision.isDenied()) {
                    if (decision.reason.isRateLimit()) {
                        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
                    } else {
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    }
                    socket.destroy();
                    return;
                }
            } catch (e) {
                console.error('WS upgrade protection error', e);
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
                return;
            }
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });
    wss.on("connection", async (socket,req) => {
        

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
        broadcastToAll(wss, { type: "match_created", data: match })

    }
    return { broadcastMatchCreated }
}
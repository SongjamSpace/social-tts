import WebSocket from 'ws';

const ws = new WebSocket('wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket', {
    headers: {
        "Origin": "https://pump.fun",
        "User-Agent": "Mozilla/5.0"
    }
});

ws.on('open', () => {
    console.log('Connected');
});

ws.on('message', (data) => {
    const text = data.toString();
    console.log('Received:', text);
    
    // Send 40 handshake when receiving connect 0
    if (text.startsWith('0{')) {
        ws.send('40{"origin":"https://pump.fun","timestamp":' + Date.now() + ',"token":null}');
    }
    // Join room when receiving handshake ack 40
    else if (text === '40') {
        const roomId = "FkgixSjNqN1R3qK2TjU6R5T7n1D3C8Y1m4c9Q"; // A known address or random string if it works
        ws.send('420["joinRoom",{"roomId":"' + roomId + '","username":"test"}]');
    }
    // Keep pinging
    else if (text === '2') {
        ws.send('3');
    }
});

ws.on('error', console.error);
ws.on('close', () => console.log('Disconnected'));

setTimeout(() => {
    ws.close();
}, 10000);

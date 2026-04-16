const WebSocket = require('ws');
const ws = new WebSocket('wss://contract.mexc.com/edge');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ "method": "sub.ticker", "param": {"symbol": "BTC_USDT"} }));
  ws.send(JSON.stringify({ "method": "sub.kline", "param": {"symbol": "BTC_USDT", "interval": "Min1"} }));
  ws.send(JSON.stringify({ "method": "sub.depth", "param": {"symbol": "BTC_USDT"} }));
  ws.send(JSON.stringify({ "method": "sub.deal", "param": {"symbol": "BTC_USDT"} }));
  
  setTimeout(() => {
    ws.close();
  }, 5000);
});

ws.on('message', (data) => {
  console.log('WS Data:', data.toString());
});

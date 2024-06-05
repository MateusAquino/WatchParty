const WebSocket = require("ws");

const watchPartyVersion = "1";
const serverPrefix = process.env.SERVER_PREFIX || "L";

let wss;
module.exports = (server) => {
  wss = new WebSocket.Server({ server });
  wss.on("connection", onConnection);

  const interval = setInterval(
    () =>
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.startMsg = Date.now();
        ws.send("ping");
      }),
    30000
  );

  wss.on("close", () => clearInterval(interval));
  console.log(`App Web Socket Server is running!`);
  return wss;
};

function onConnection(ws, req) {
  if (!req.headers["sec-websocket-protocol"]) return ws.terminate();
  const protocol = req.headers["sec-websocket-protocol"].charAt(0);
  ws.userId = req.headers["sec-websocket-key"];

  if (!protocols[protocol]) return ws.terminate();
  const params = req.headers["sec-websocket-protocol"]
    .split("#")
    .map((p) => decodeURIComponent(p));
  const v = params[1];
  if (v !== watchPartyVersion) {
    ws.send("upgrade");
    return ws.terminate();
  }
  ws.isAlive = true;
  ws.startMsg = Date.now();
  ws.send("ping");
  ws.on("message", (data, binary) => (binary ? null : onMessage(ws, data)));
  ws.on("error", (error) => onError(ws, error));
  ws.on("close", () => onClose(ws));
  protocols[protocol](ws, params);
}

function onError(ws, err) {
  console.error(`onError: ${err.message}`);
}

function onClose(ws) {
  const partyCode = ws.partyCode;
  if (!partyCode) return;
  const party = parties[partyCode];
  if (party.clients.length === 1) delete parties[partyCode];
  else {
    party.clients = party.clients.filter((el) => el !== ws);
    if (!party.clients.find((ws) => ws.isHost)) party.clients[0].isHost = true;
    updateParty(party);
  }
}

function updateParty(party) {
  const partyMembers = party.clients.map((ws) => ({
    userId: ws.userId,
    userName: ws.userName,
    isHost: ws.isHost,
  }));

  party.clients.forEach((ws) => {
    ws.send(
      "party:" +
        JSON.stringify({
          name: party.name,
          code: party.code,
          members: partyMembers,
        })
    );
  });
}

function onMessage(ws, data) {
  data = data.toString();
  if (data.startsWith("msg:")) {
    parties[ws.partyCode].clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send("msg:" + ws.userId + ":" + data.substring(4));
      }
    });
  } else if (ws.isHost && data.startsWith("toggle:")) {
    const id = data.substring(7);
    const hosts = parties[ws.partyCode].clients.filter((ws) => ws.isHost);
    const user = parties[ws.partyCode].clients.find(
      (client) => client.userId === id
    );
    if (user && (hosts.length > 1 || !user.isHost)) {
      user.isHost = !user.isHost;
      updateParty(parties[ws.partyCode]);
    }
  } else if (ws.isHost && data.startsWith("cmd:")) {
    parties[ws.partyCode].clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        const latencies = (ws.latency || 0) + (client.latency || 0);
        client.send("cmd:" + Math.round(latencies) + ":" + data.substring(4));
      }
    });
  } else if (data === "pong") {
    ws.isAlive = true;
    ws.latency = ws.latency = Date.now() - ws.startMsg;
  }
}

const protocols = {
  c: createParty,
  j: joinParty,
};

const parties = {};

function generatePartyCode(tries = 0) {
  const characters = "0123456789ABCDEHIJKLMNORSTUVWYZ";
  const length = 5 + Math.floor(tries / 3);
  let code = serverPrefix;
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  if (parties[code]) return generatePartyCode(tries + 1);
  return code;
}

function createParty(ws, params) {
  const userName = params[2] || "Anonymous";
  const password = params[3] || "";
  const name = params[4] || "WatchParty";
  const joinAsHost = params[5] || "0";
  const code = generatePartyCode();
  ws.partyCode = code;
  ws.isHost = true;
  ws.userName = userName;
  parties[code] = {
    code,
    password,
    name,
    joinAsHost: joinAsHost === "1",
    clients: [ws],
  };
  updateParty(parties[code]);
}

function joinParty(ws, params) {
  const userName = params[2] || "Anonymous";
  const code = params[3] || "???";
  const password = params[4] || "";
  const party = parties[code];
  if (party && party.password === password) {
    ws.partyCode = code;
    ws.isHost = party.joinAsHost;
    ws.userName = userName;
    party.clients.push(ws);
    updateParty(party);
  } else {
    ws.send("badroom");
    ws.terminate();
  }
}

<h1 align="center">
  <img width="250" src="./logo.png" align="center"></img>
</h1>

<p align="center">▶️ <strong>WatchParty</strong> is a BetterStremio session sharing plugin.</p>

<p align="center">
  <a href="https://mateusaquino-watchparty.hf.space">
    <img src="https://img.shields.io/website?url=https%3A%2F%2Fmateusaquino-watchparty.hf.space&label=Server+H"></img>
  </a>
  <a href="https://mateusaqb-watchparty.hf.space">
    <img src="https://img.shields.io/website?url=https%3A%2F%2Fmateusaqb-watchparty.hf.space&label=Server+U"></img>
  </a>
</p>

## 🎉 WatchParty

<p align="left">
  <a target="_blank" href="https://github.com/MateusAquino/WatchParty/assets/16140783/bbe21561-c07a-48ae-9cf0-9613cbde665a">
    <img width="300px" alt="Archer Logo" title="Archer Logo" align="right" src="https://github.com/MateusAquino/WatchParty/assets/16140783/5e986203-361b-4ef8-bd21-69bee97cdfcd"></img>
  </a>
</p>

**WatchParty** is the first [BetterStremio](https://github.com/MateusAquino/BetterStremio) plugin ever made. It was developed to connect multiple Stremio sessions at once. You can use it to start a Stremio session with friends: create and join watch party, chat and share controls. No addon sharing required.

This Plugin works by intercepting events on the Stremio HTML5 Player and sharing to everyone in the party through a websocket connection. Currently there are two available servers to connect from: [Hugging Face (H)](https://mateusaquino-watchparty.hf.space) and [Hugging Face (U)](https://mateusaqb-watchparty.hf.space).

This repository is currently accepting contributions and suggestions, feel free to do so :)

Now we also feature a realtime chat with party members and you're allowed to use emojis and color codes in your name and messages.

## ▶️ Demo

This is a demo of WatchParty synchronizing three instances:

- Instance 1 (black): Patched `Stremio.exe` app with **MPV Player**
- Instance 2 (red): Patched Stremio Webapp (`127.0.0.1:11470`) with **HTML5 Player**
- Instance 3 (green): Patched Stremio Webapp (`127.0.0.1:11470`) with **HTML5 Player**

https://github.com/user-attachments/assets/15bb9c95-692a-4150-973f-84bf9d33b2ab

Note: All instances were running on the same `server.js` (same Windows machine), which improved buffering. In a real scenario, use a high-availability stream and ensure everyone has a stable internet connection.

Chat features include:
- Colored messages
- Styled messages (bold, italic, underline, mts, ...)
- Emojis
- Message history (navigate using the up and down arrow keys)


## 🌐 WatchParty Server

WatchParty is meant to be open for the public, but if you need to work on something locally you can also setup your own server.

### Local server

You can Setup a local server by running:

```bash
git clone https://github.com/MateusAquino/WatchParty
npm i
npm start
```

A WatchParty server instance will be up at `localhost:3000`.  
You may also change the env variables if needed: `PORT` and `SERVER_PREFIX` (single letter, defaults to `L`).  

This repository also contains the `Dockerfile` used to host the websocket server at [Hugging Face](https://huggingface.co/spaces/MateusAquino/WatchParty/tree/main).

### Server Connection

Connection protocol params must be separated by `#` and encoded (`encodeURIComponent`):

#### Create Party

- protocol: `c`
- `param[1]`: WatchParty protocol version
- `param[2]`: Username (string)
- `param[3]`: Party Password (string)
- `param[4]`: Party Name (string)
- `param[5]`: Join as Host? (1/0)

Usage example: `c#1#John#123#Example%20Party#1`

#### Join Party

- protocol: `j`
- `param[1]`: WatchParty protocol version
- `param[2]`: Username (string)
- `param[3]`: Party Code (string)
- `param[4]`: Party Password (string)

Usage example: `c#1#Jane#LJ7HLC#123`

### Packets

#### Server Packets

```elixir
upgrade               -> Sent if protocol version mismatch  
party:<party>         -> Returns a JSON party whenever there is a host/clients update  
msg:<id>:<msg>        -> Returns the user id and the message broadcasted to the party  
cmd:<latencies>:<cmd> -> Returns a JSON command used by WatchParty to sync actions and the sum of latencies from one client to another (example `cmd:130:go:["player", {...}]`)  
badroom               -> Sent if room code/password is wrong  
ping                  -> Awaits for pong message (30s timeout)
```

Note: party packet returns the generated code, the first letter should be unique for each server (or "L" for local)

#### Client Packets

```elixir
msg:<msg>       -> Broadcasts message to party  
toggle:<userId> -> Toggles user host privileges (must be a host & > 1 host in the party)  
cmd:<cmd>       -> Broadcasts JSON command to party (must be a host)  
pong            -> Ping response
```

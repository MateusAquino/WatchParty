module.exports = class WatchParty {
  getName() {
    return "WatchParty";
  }
  getImage() {
    return "https://raw.githubusercontent.com/MateusAquino/WatchParty/main/logo.png";
  }
  getDescription() {
    return "Start a Stremio session with friends: watch party, chat (soon) and share controls. No addon sharing required.";
  }
  getVersion() {
    return "1.0.1";
  }
  getAuthor() {
    return "MateusAquino";
  }
  getShareURL() {
    return "https://github.com/MateusAquino/WatchParty";
  }
  getUpdateURL() {
    return "https://raw.githubusercontent.com/MateusAquino/WatchParty/main/WatchParty.plugin.js";
  }
  onBoot() {}
  onReady() {}
  onLoad() {
    const windowControls = document.getElementById("window-controls");
    const WatchPartyControl = document.createElement("li");
    WatchPartyControl.id = "wp-control";
    WatchPartyControl.innerHTML = this.control();

    const WatchPartyPopup = document.createElement("div");
    WatchPartyPopup.id = "wp-popup";
    WatchPartyPopup.innerHTML = this.popup();
    WatchPartyPopup.classList.add("wp-noparty");
    WatchPartyPopup.classList.add("wp-noparty");

    WatchPartyControl.onclick = () => this.openUI();
    windowControls.insertBefore(WatchPartyControl, windowControls.firstChild);

    windowControls.insertBefore(
      WatchPartyPopup,
      windowControls.firstChild.nextSibling
    );

    window.WatchParty = {};
    window.WatchParty.code = () => WatchParty.client?.party?.code;
    window.WatchParty.create = () => this.btnCreate(this.element);
    window.WatchParty.join = () => this.btnJoin(this.element);
    window.WatchParty.confirm = () => this.btnConfirm(this.element);
    window.WatchParty.toggle = (userId) =>
      WatchParty.client.send(`toggle:${userId}`);
    window.WatchParty.broadcast = this.broadcastCommand;
    window.WatchParty.execute = this.execCommand;
    window.WatchParty.inject = this.inject;
    window.WatchParty.leave = () =>
      WatchParty.client?.terminate?.() || WatchParty.client?.close?.();
    window.WatchParty.failedServers = [];

    const servers = this.getServers();
    for (const server of Object.values(servers)) {
      const statusEndpoint = server
        .replace("ws://", "http://")
        .replace("wss://", "https://");
      const xhr = new XMLHttpRequest();
      xhr.open("GET", statusEndpoint, true);
      xhr.onload = () => {
        if (xhr.status === 200)
          console.log("[WatchParty] Server available: ", server);
      };
      xhr.send();
    }

    this.inject();
  }
  onEnable() {
    this.onLoad();
  }
  onDisable() {
    WatchParty.client?.terminate?.() || WatchParty.client?.close?.();
    this.element("control").remove();
    window.WatchParty = undefined;
  }
  getServers() {
    return {
      L: "ws://localhost:3000/",
      R: "wss://watchparty-kyiy.onrender.com",
      G: "wss://dramatic-hazel-epoch.glitch.me",
      // A: "wss://watch-party.adaptable.app",
    };
  }
  pickRandom(partyServer) {
    const servers = this.getServers();
    const availableServers = Object.keys(servers).filter(
      (server) =>
        server.startsWith(partyServer) &&
        !window.WatchParty.failedServers.includes(servers[server])
    );

    if (availableServers.length > 0) {
      const randomServer =
        availableServers[Math.floor(Math.random() * availableServers.length)];
      return servers[randomServer];
    } else {
      return false;
    }
  }
  connect(protocol, partyServer = "") {
    if (WatchParty.client)
      WatchParty.client.terminate?.() || WatchParty.client.close?.();
    const server = this.pickRandom(partyServer);
    if (!server) {
      document.getElementById("wp-popup").classList.remove("wp-loading");
      document.getElementById("wp-popup").classList.add("wp-noparty");
      return BetterStremio.Toasts.error(
        "Failed to create/join party.",
        "Couldn't find any servers available! Try again in a minute."
      );
    }
    WatchParty.client = new WebSocket(server, protocol);
    WatchParty.client.heartbeat = () => {
      const client = this;
      clearTimeout(this.pingTimeout);
      this.pingTimeout = setTimeout(() => {
        client.terminate?.() || client.close?.();
        console.error("[WatchParty] Connection timeout!");
        BetterStremio.Toasts.error(
          "Disconnected from party!",
          "You have been disconnected due to timeout."
        );
      }, 30000 + 4000);
    };
    const retry = () => this.connect(protocol, partyServer);
    WatchParty.client.onerror = () => {
      window.WatchParty.failedServers.push(server);
      retry();

      setTimeout(() => {
        const index = window.WatchParty.failedServers.indexOf(server);
        if (index > -1) window.WatchParty.failedServers.splice(index, 1);
      }, 1 * 60 * 1000);
    };
    WatchParty.client.onmessage = this.handleMessage;
    WatchParty.client.onopen = WatchParty.client.heartbeat;

    window.WatchParty.warnOnClose = false;
    const warnTimeout = setTimeout(() => {
      window.WatchParty.warnOnClose = true;
    }, 5000);

    WatchParty.client.onclose = () => {
      clearTimeout(warnTimeout);
      if (window.WatchParty.warnOnClose)
        BetterStremio.Toasts.warning("Disconnected!", "You've left the party.");
      document.getElementById("wp-popup").classList.remove("wp-loading");
      document.getElementById("wp-popup").classList.add("wp-noparty");
      console.log("[WatchParty] Connection closed.");
      clearTimeout(this.pingTimeout);
    };
  }
  openUI() {
    this.element("popup").classList.toggle("show");
  }
  element(id) {
    return document.getElementById(`wp-${id}`);
  }
  btnCreate(element) {
    delete this.isJoining;
    element("create-btn").classList.add("selected");
    element("join-btn").classList.remove("selected");
    element("create").classList.remove("hidden");
    element("join").classList.add("hidden");
  }
  btnJoin(element) {
    this.isJoining = true;
    element("create-btn").classList.remove("selected");
    element("join-btn").classList.add("selected");
    element("create").classList.add("hidden");
    element("join").classList.remove("hidden");
  }
  btnConfirm(element) {
    element("popup").classList.add("wp-loading");
    if (!this.isJoining) {
      const username = encodeURIComponent(element("create-user").value);
      const partyName = encodeURIComponent(element("create-name").value);
      const partyPass = encodeURIComponent(element("create-pass").value);
      const joinAsHost = element("create-joinashost").checked;
      const protocol = `c#1#${username}#${partyPass}#${partyName}#${
        joinAsHost ? "1" : "0"
      }`;
      this.connect(protocol);
    } else {
      const username = encodeURIComponent(element("join-user").value);
      const partyCode = encodeURIComponent(
        element("join-code").value
      ).toUpperCase();
      const partyPass = encodeURIComponent(element("join-pass").value);
      const protocol = `j#1#${username}#${partyCode}#${partyPass}`;
      this.connect(protocol, partyCode.substring(0, 1));
    }
  }
  handleMessage(message) {
    document.getElementById("wp-popup").classList.remove("wp-loading");
    const client = message.currentTarget;
    if (message.data === "ping") {
      client.send("pong");
      client.heartbeat();
    } else if (message.data === "badroom") {
      document.getElementById("wp-join-pass").value = "";
      BetterStremio.Toasts.error(
        "Failed to join party!",
        "The combination code/password does not exists."
      );
    } else if (message.data === "upgrade")
      BetterStremio.Toasts.error(
        "WatchParty version not supported!",
        "Please upgrade your plugin version to use "
      );
    else if (message.data.startsWith("party:")) {
      const newParty = JSON.parse(message.data.substring(6));
      if (client.party && newParty) {
        const oldMembers = client.party.members;
        const newMembers = newParty.members;

        if (oldMembers.length < newMembers.length) {
          const joinedMember = newMembers.find(
            (member) =>
              !oldMembers.map((el) => el.userId).includes(member.userId)
          );
          BetterStremio.Toasts.info(
            "Party Update",
            `${joinedMember.userName} has joined the party`
          );
        } else if (oldMembers.length > newMembers.length) {
          const leftMember = oldMembers.find(
            (member) =>
              !newMembers.map((el) => el.userId).includes(member.userId)
          );
          BetterStremio.Toasts.info(
            "Party Update",
            `${leftMember.userName} has left the party`
          );
        } else {
          for (let i = 0; i < newMembers.length; i++) {
            if (oldMembers[i].isHost !== newMembers[i].isHost) {
              const member = newMembers[i];
              const action = member.isHost ? "promoted to" : "demoted from";
              BetterStremio.Toasts.info(
                "Party Update",
                `${member.userName} was ${action} host`
              );
            }
          }
        }
      }
      client.party = newParty;
      document.getElementById("wp-popup").classList.remove("wp-noparty");
      document.getElementById("wp-partyname").innerText = newParty.name;
      document.getElementById("wp-partycode").innerText = newParty.code;
      document.getElementById("wp-partymembers").innerHTML = newParty.members
        .map(
          (member) =>
            `<div class="row user-row">
            ${member.userName} ${member.isHost ? "(host)" : ""}
            <button onclick="WatchParty.toggle('${
              member.userId
            }')">Toggle Host</button>
            </div>`
        )
        .join("");
    } else if (message.data.startsWith("cmd:")) {
      const cmdLine = message.data.substring(4);
      const separatorIndex = cmdLine.indexOf(":");
      if (separatorIndex === -1) return;
      const latency = cmdLine.substring(0, separatorIndex);
      const remainingData = cmdLine.substring(separatorIndex + 1);
      const secondSeparatorIndex = remainingData.indexOf(":");
      if (secondSeparatorIndex === -1) return;
      const cmd = remainingData.substring(0, secondSeparatorIndex);
      const jsonData = remainingData.substring(secondSeparatorIndex + 1);
      if (!jsonData) return;
      const data = JSON.parse(jsonData);
      if (data) window.WatchParty.execute(latency, cmd, data);
    }
  }
  inject() {
    if (!window.WatchParty.injectedStateChange) {
      BetterStremio.StremioRoot.$on("$stateChangeSuccess", (_scs) => {
        window.WatchParty.inject();
      });
      window.WatchParty.injectedStateChange = true;
    }

    if (!window.WatchParty.injectedGo) {
      const oldGoFn = BetterStremio.Modules.$state.go;
      BetterStremio.Modules.$state.go = function () {
        if (arguments[0] === "player/NO_SPREAD") arguments[0] = "player";
        else if (arguments[0] === "player")
          window.WatchParty.broadcast("go", Array.from(arguments));

        return oldGoFn.apply(oldGoFn, arguments);
      };
      window.WatchParty.injectedGo = true;
    }

    if (!window.WatchParty.injectedHtml5 && BetterStremio.Modules.deviceHtml5) {
      BetterStremio.Modules.deviceHtml5.addListener("statechanged", (state) => {
        if (state.NO_SPREAD) return;
        if (
          BetterStremio.Modules.deviceHtml5.time ===
          window.WatchParty.NO_SPREAD_TIME
        )
          return;
        window.WatchParty.broadcast("state", {
          state,
          time: BetterStremio.Modules.deviceHtml5.time,
          paused: BetterStremio.Modules.deviceHtml5.paused,
          playbackSpeed: BetterStremio.Modules.deviceHtml5.playbackSpeed,
        });
      });
      BetterStremio.Modules.deviceHtml5.addListener("timeupdate", () => {
        delete window.WatchParty.NO_SPREAD;
      });
      BetterStremio.Modules.deviceHtml5.addListener("error", (error) => {
        window.WatchParty.broadcast("error", error);
      });
      window.WatchParty.injectedHtml5 = true;
    }

    if (!window.WatchParty.injectedMPV && BetterStremio.Modules.deviceMPV) {
      BetterStremio.Modules.deviceMPV.addListener("statechanged", (state) => {
        if (state.NO_SPREAD) return;
        if (
          BetterStremio.Modules.deviceMPV.time ===
          window.WatchParty.NO_SPREAD_TIME
        )
          return;
        window.WatchParty.broadcast("state", {
          state,
          time: BetterStremio.Modules.deviceMPV.time,
          paused: BetterStremio.Modules.deviceMPV.paused,
          playbackSpeed: BetterStremio.Modules.deviceMPV.playbackSpeed,
        });
      });
      BetterStremio.Modules.deviceMPV.addListener("timeupdate", () => {
        delete window.WatchParty.NO_SPREAD;
      });
      BetterStremio.Modules.deviceMPV.addListener("error", (error) => {
        window.WatchParty.broadcast("error", error);
      });
      window.WatchParty.injectedMPV = true;
    }
  }

  broadcastCommand(cmd, data) {
    if (WatchParty.client && !window.WatchParty.NO_SPREAD) {
      try {
        const dataStr = JSON.stringify(data);
        WatchParty.client.send?.(`cmd:${cmd}:${dataStr}`);
      } catch (e) {}
    }
  }
  execCommand(latency, cmd, data) {
    const strData = JSON.stringify(data);
    if (cmd === "go") {
      const playerData = data;
      playerData.shift();
      BetterStremio.Modules.$state.go("player/NO_SPREAD", ...playerData);
    } else if (
      cmd === "state" &&
      (BetterStremio.Modules.deviceMPV || BetterStremio.Modules.deviceHtml5) &&
      !window.WatchParty.NO_SPREAD
    ) {
      window.WatchParty.NO_SPREAD = true;
      if (data.playbackSpeed)
        BetterStremio.Modules.deviceHtml5.playbackSpeed = data.playbackSpeed;
      if (data.playbackSpeed)
        BetterStremio.Modules.deviceMPV.playbackSpeed = data.playbackSpeed;
      if (BetterStremio.Modules.deviceHtml5.paused !== data.paused)
        BetterStremio.Modules.deviceHtml5.paused = data.paused;
      if (BetterStremio.Modules.deviceMPV.paused !== data.paused)
        BetterStremio.Modules.deviceMPV.paused = data.paused;
      if (window.WatchParty.LAST_STATE !== strData && !data.paused) {
        window.WatchParty.NO_SPREAD_TIME = data.time + parseInt(latency);
        BetterStremio.Modules.deviceHtml5.time = data.time + parseInt(latency);
        BetterStremio.Modules.deviceMPV.time = data.time + parseInt(latency);
      }
      BetterStremio.Modules.deviceHtml5?.emit?.("statechanged", {
        ...data.state,
        NO_SPREAD: true,
      });
      BetterStremio.Modules.deviceMPV?.emit?.("statechanged", {
        ...data.state,
        NO_SPREAD: true,
      });
      window.WatchParty.LAST_STATE = strData;
      delete window.WatchParty.NO_SPREAD;
    }
  }
  control() {
    return `<svg class="icon" viewBox="0,0,256,256"><path d="M 106.56 10.56 C 94.613 10.56 84.171 17.067 78.731 26.88 L 78.4 26.453 C 77.12 26.24 75.744 26.251 74.357 26.251 C 58.997 26.251 46.176 37.013 43.083 51.52 C 35.893 55.467 30.443 62.123 27.957 70.101 C 26.4 70.741 27.093 70.336 24.683 71.307 C 23.029 72.395 22.912 72.491 22.155 73.824 C 21.227 75.072 20.363 77.76 20.789 80.853 L 42.123 235.52 C 42.869 240.853 47.456 244.789 52.789 244.789 L 141.941 244.789 C 142.528 244.896 143.072 245.12 143.691 245.12 L 207.691 245.12 C 213.237 245.12 217.824 240.853 218.357 235.413 L 228.171 122.667 L 234.667 122.667 L 234.667 101.333 L 219.083 101.333 C 218.901 101.323 218.741 101.227 218.56 101.227 L 211.872 101.227 L 215.456 90.56 L 230.837 90.56 L 230.837 69.227 L 207.893 69.227 C 203.307 69.227 199.083 71.467 197.696 75.84 L 197.547 76.267 L 189.248 101.227 L 179.712 101.227 L 181.12 80.416 C 181.333 77.536 180.277 74.677 178.357 72.544 C 177.205 71.328 175.755 70.528 174.208 69.984 C 171.755 62.336 166.571 55.947 159.787 52.064 C 159.253 35.744 146.453 22.507 130.453 21.227 C 124.587 14.72 116.053 10.56 106.56 10.56 Z M 105.813 31.349 C 109.867 31.349 113.291 33.483 115.211 36.789 C 117.344 40.523 121.504 42.656 125.877 42.123 L 127.349 42.123 C 133.216 42.123 138.016 46.816 138.016 52.789 C 138.016 53.856 137.92 54.827 137.707 55.787 C 136.853 58.56 137.28 61.653 138.88 64.213 C 140.16 66.453 142.293 68.064 144.853 68.917 L 56.651 68.917 C 60.917 67.424 63.797 63.253 63.691 58.667 L 63.691 58.357 C 63.691 52.384 68.384 47.691 74.357 47.691 C 76.384 47.691 78.187 48.203 79.787 49.163 C 82.88 50.976 86.709 51.2 90.016 49.6 C 93.216 48 95.467 44.789 95.893 41.269 C 96.533 35.936 99.989 31.349 105.536 31.349 L 105.813 31.349 Z M 43.872 90.357 L 54.56 90.357 L 72.917 223.456 L 62.187 223.456 L 43.872 90.357 Z M 76.107 90.357 L 158.912 90.357 L 158.229 101.227 L 133.227 101.227 C 133.067 101.227 132.917 101.323 132.747 101.333 L 117.333 101.333 L 117.333 122.667 L 123.232 122.667 L 132 223.456 L 94.453 223.456 L 76.107 90.357 Z M 144.853 122.667 L 206.731 122.667 L 197.984 223.893 L 159.456 223.893 L 159.456 223.456 L 153.557 223.456 L 144.853 122.667 Z" style="paint-order: fill; fill: currentColor; stroke: rgb(0, 0, 0); mix-blend-mode: exclusion; stroke-width: 6px;" fill-rule="nonzero" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="none"></path></svg>`;
  }
  popup() {
    return `
    <h3>WatchParty <span>v${this.getVersion()}</span></h3>
    
    <button id="wp-create-btn" class="wp-noparty-show selected" onclick="WatchParty.create()">Create</button>
    <button id="wp-join-btn" class="wp-noparty-show" onclick="WatchParty.join()">Join</button>

    <div id="wp-create" class="tab">
      <div class="row">Username: <input id="wp-create-user" oninput="BetterStremio.Data.store('WatchParty', 'user', this.value)" value="${
        BetterStremio.Data.read("WatchParty", "user") || ""
      }" autocomplete="false" type="text"/></div>
      <div class="row">Party Name: <input id="wp-create-name" oninput="BetterStremio.Data.store('WatchParty', 'party', this.value)" value="${
        BetterStremio.Data.read("WatchParty", "party") || "Watch Party"
      }" autocomplete="false" type="text"/></div>
      <div class="row">Party Pass: <input id="wp-create-pass" oninput="BetterStremio.Data.store('WatchParty', 'pass', this.value)" value="${
        BetterStremio.Data.read("WatchParty", "pass") || ""
      }" autocomplete="false" type="text"/></div>
      <div class="row">New members as host: <input id="wp-create-joinashost" onchange="BetterStremio.Data.store('WatchParty', 'joinAsHost', this.checked)" ${
        BetterStremio.Data.read("WatchParty", "joinAsHost") === "true"
          ? "checked"
          : ""
      } autocomplete="false" type="checkbox"/></div>
    </div>

    <div id="wp-join" class="tab hidden">
      <div class="row">Username: <input id="wp-join-user" oninput="BetterStremio.Data.store('WatchParty', 'user', this.value)" value="${
        BetterStremio.Data.read("WatchParty", "user") || ""
      }" autocomplete="false" type="text"/></div>
      <div class="row">Party Code: <input id="wp-join-code" autocomplete="false" type="text"/></div>
      <div class="row">Party Pass: <input id="wp-join-pass" oninput="BetterStremio.Data.store('WatchParty', 'pass', this.value)" value="${
        BetterStremio.Data.read("WatchParty", "pass") || ""
      }" autocomplete="false" type="text"/></div>
    </div>

    <div id="wp-loading" class="tab">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width="208" height="208" style="shape-rendering: auto;display: block;"><g data-idx="1"><circle stroke-linecap="round" fill="none" stroke="#9370db" stroke-width="3" r="18" cy="50" cx="50" data-idx="2" stroke-dasharray="28.274333882308138 28.274333882308138"></circle><g data-idx="4"></g></g></svg>
    </div>

    <div id="wp-inparty" class="tab" style="margin-top: 10px;">
      <h3 class="row" style="justify-content: flex-start; margin-bottom: 10px;">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24px" height="24px" viewBox="0,0,256,256"><g fill="currentColor" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10"><g transform="scale(10.66667,10.66667)"><path d="M12,2.09961l-11,9.90039h3v9h1h15v-9h3zM12,4.79102l6,5.40039v8.80859h-2v-6h-3v6h-7v-8.80859zM8,13v3h3v-3z"></path></g></g></svg>
        <span id="wp-partyname" style="color: inherit; font-size: 1em;"></span>
        <button style="margin: 0; margin-left: auto; margin-right: 8px;" onclick="WatchParty.leave()">Leave</button>
      </h3>
      <h3 class="row" onclick="BetterStremio.Sharing.copyToClipboard(WatchParty.code())" style="cursor: pointer; color: gray;justify-content: flex-start;margin-bottom: 10px;">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="18px" height="18px" viewBox="0,0,256,256" style=" margin-left: 3px; margin-right: 3px; "><g fill="currentColor" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10"><g transform="scale(10.66667,10.66667)"><path d="M12,1c-1.64501,0 -3,1.35499 -3,3c0,0.35185 0.07394,0.68511 0.1875,1h-6.1875c-1.103,0 -2,0.897 -2,2v12c0,1.103 0.897,2 2,2h18c1.103,0 2,-0.897 2,-2v-12c0,-1.103 -0.897,-2 -2,-2h-6.1875c0.11356,-0.31489 0.1875,-0.64815 0.1875,-1c0,-1.64501 -1.35499,-3 -3,-3zM12,3c0.56413,0 1,0.43587 1,1c0,0.56413 -0.43587,1 -1,1c-0.56413,0 -1,-0.43587 -1,-1c0,-0.56413 0.43587,-1 1,-1zM3,7h9h9l0.00195,12h-18.00195zM9,9c-1.10457,0 -2,0.89543 -2,2c0,1.10457 0.89543,2 2,2c1.10457,0 2,-0.89543 2,-2c0,-1.10457 -0.89543,-2 -2,-2zM15,10v2h4v-2zM9,14c-2.185,0 -4,0.9088 -4,2.2168v0.7832h8v-0.7832c0,-1.308 -1.815,-2.2168 -4,-2.2168zM15,14v2h4v-2z"></path></g></g></svg>
        <span id="wp-partycode" style="color: inherit;font-size: .8em;"></span>
      </h3>
      <div id="wp-partymembers"></div>
    </div>
    
    <button class="wp-noparty-show" onclick="WatchParty.confirm()" style=" float: right; margin-top: 15px;">Enter</button>

    <style type="text/css">
      #wp-popup .tab.hidden {
        display: none;
      }

      #wp-popup {
        display: none;
        background: #0c0c11;
        min-width: 300px;
        width: fit-content;
        position: absolute;
        top: 50px;
        right: 95px;
        border-radius: 8px;
        box-shadow: rgba(0, 0, 0, 0.2) 0px 10px 15px;
        padding: 20px;
      }

      #wp-popup.show {
        display: block;
      }

      #wp-popup h3 span {
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.7em;
      }

      #wp-popup button {
        padding: 4px 10px;
        margin: 8px 8px 8px 0px;
        border-radius: 4px;
        background-color: mediumpurple;
        color: white;
        cursor: pointer;
        font-weight: bold;
      }

      #wp-popup button:hover, 
      #wp-popup button.selected {
        background-color: rebeccapurple;
      }

      #wp-popup .row {
        display: flex;
        align-items: center;
        margin-top: 8px;
        white-space: nowrap;
        gap: 10px;
        justify-content: space-between;
      }

      #wp-popup .row.user-row {
        padding-top: 5px;
        margin-top: 5px;
        border-top: 1px solid #ffffff22;
      }

      #wp-popup .row div {
        display: none !important;
      }

      #wp-popup input[type="text"] {
        width: 100%;
        min-width: 30px;
      }

      .wp-loading div, #wp-loading {
        display: none;
      }

      .wp-loading #wp-loading {
        display: flex;
        justify-content: center;
      }

      .wp-loading button {
        display: none !important;
      }

      .wp-noparty button, 
      .wp-noparty-show, 
      #wp-popup:not(.wp-noparty) .tab,
      #wp-inparty {
        display: none;
      }

      #wp-popup:not(.wp-noparty) #wp-inparty {
        display: block;
      }
      
      .wp-noparty button.wp-noparty-show {
        display: inline;
      }

      #wp-popup #wp-loading svg {
        animation-name: spin;
        animation-duration: 650ms;
        animation-iteration-count: infinite;
        animation-timing-function: linear; 
      }

      @keyframes spin {from {transform:rotate(0deg);}to {transform:rotate(360deg);}}

      @media (min-width: 1500px) {
        #wp-popup {
          top: 60px;
          right: 118px;
        }
      }
    </style>`;
  }
};

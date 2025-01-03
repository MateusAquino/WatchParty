module.exports = class WatchParty {
  /* ---- BetterStremio defined methods ---- */
  getName = () => "WatchParty";
  getImage = () =>
    "https://raw.githubusercontent.com/MateusAquino/WatchParty/main/logo.png";
  getDescription = () =>
    "Start a Stremio session with friends: watch party, chat and share controls (no addon sharing required). Make sure to play high availability movies/series to avoid buffering issues.";
  getVersion = () => "1.1.0";
  getAuthor = () => "MateusAquino";
  getShareURL = () => "https://github.com/MateusAquino/WatchParty";
  getUpdateURL = () =>
    "https://raw.githubusercontent.com/MateusAquino/WatchParty/main/WatchParty.plugin.js";
  onBoot = () => {};
  onReady = () => {};
  onEnable = () => this.onLoad();

  onDisable() {
    clearInterval(window.WatchParty.playerObserver);
    clearInterval(window.WatchParty.chatObserver);
    document.removeEventListener("click", this.outsideClickListener);
    this.openUI(false);

    if (BetterStremio.Modules.$state.go.wpInjected) {
      BetterStremio.Modules.$state.go.wpInjected = false;
      BetterStremio.Modules.$state.go = window.WatchParty.uninjectedGo;
    }

    if (BetterStremio.Scopes?.playerControlsCtrl?.playerGoBack?.wpInjected) {
      BetterStremio.Scopes.playerControlsCtrl.playerGoBack.wpInjected = false;
      BetterStremio.Scopes.playerControlsCtrl.playerGoBack =
        window.WatchParty.uninjectedPlayerGoBack;
    }

    const device = BetterStremio.Player;

    if (device && device.wpInjected) {
      device.removeListener(
        "statechanged",
        window.WatchParty.events.onStateChanged,
      );
      device.removeListener(
        "timeupdate",
        window.WatchParty.events.onTimeUpdate,
      );
      device.removeListener("error", window.WatchParty.events.onError);
      device.wpInjected = false;
    }

    window.WatchParty.leave();
    clearTimeout(window.WatchParty.pingTimeout);
    this.element("control").remove();
    this.element("chat").remove();
    this.element("chat-style").remove();
    window.WatchParty = undefined;
  }

  onLoad() {
    const windowControls = document.getElementById("window-controls");
    const WatchPartyControl = document.createElement("li");
    WatchPartyControl.id = "wp-control";
    WatchPartyControl.innerHTML = this.control();
    WatchPartyControl.onclick = () => this.openUI();

    const WatchPartyPopup = document.createElement("div");
    WatchPartyPopup.id = "wp-popup";
    WatchPartyPopup.innerHTML = this.popup();
    WatchPartyPopup.classList.add("wp-noparty");

    this.outsideClickListener = (event) => {
      const isClickInside = WatchPartyControl.contains(event.target) ||
        WatchPartyPopup.contains(event.target);
      if (!isClickInside) this.openUI(false);
    };

    document.addEventListener("click", this.outsideClickListener);

    windowControls.insertBefore(WatchPartyControl, windowControls.firstChild);

    windowControls.insertBefore(
      WatchPartyPopup,
      windowControls.firstChild.nextSibling,
    );

    window.WatchParty = {};
    window.WatchParty.code = () => window.WatchParty.client?.party?.code;
    window.WatchParty.create = () => this.btnCreate(this.element);
    window.WatchParty.join = () => this.btnJoin(this.element);
    window.WatchParty.confirm = () => this.btnConfirm(this.element);
    window.WatchParty.toggle = (userId) =>
      window.WatchParty.client.send(`toggle:${userId}`);
    window.WatchParty.applyObfuscation = this.applyObfuscation;
    window.WatchParty.broadcast = this.broadcastCommand;
    window.WatchParty.sendMessage = this.sendMessage;
    window.WatchParty.mineParse = this.mineParse;
    window.WatchParty.applyCode = this.applyCode;
    window.WatchParty.execute = this.execCommand;
    window.WatchParty.message = this.message;
    window.WatchParty.inject = this.inject;
    window.WatchParty.picker = this.picker;
    window.WatchParty.leave = () =>
      window.WatchParty.client?.terminate?.() ||
      window.WatchParty.client?.close?.();
    window.WatchParty.stateChangedInterval = 100;
    window.WatchParty.failedServers = [];
    window.WatchParty.events = {
      onStateChanged: this.onStateChanged,
      onTimeUpdate: this.onTimeUpdate,
      onError: this.onError,
    };
    window.WatchParty.chatObserver = setInterval(() => {
      const hideChat =
        document.querySelector('[ui-view="detail"]:not(.ng-hide)') ||
        document.querySelector(".control.active");
      document.getElementById("wp-chat").style.pointerEvents = hideChat
        ? "none"
        : "auto";
    }, 400);
    window.WatchParty.playerObserverPaused = null;
    window.WatchParty.playerObserverSpeed = null;
    window.WatchParty.playerObserver = setInterval(() => {
      if (
        (window.WatchParty.playerObserverPaused !==
            window.BetterStremio.Player.paused &&
          window.BetterStremio.Player.paused !== null) ||
        window.WatchParty.playerObserverSpeed !==
          window.BetterStremio.Player.playbackSpeed
      ) {
        window.WatchParty.broadcast("state", {
          state: window.BetterStremio.Player.state,
          time: window.BetterStremio.Player.time,
          paused: window.BetterStremio.Player.state === 2
            ? window.WatchParty.playerObserverPaused
            : window.BetterStremio.Player.paused,
          playbackSpeed: window.BetterStremio.Player.playbackSpeed,
          force: true,
        });
        window.WatchParty.playerObserverPaused =
          window.BetterStremio.Player.paused;
        window.WatchParty.playerObserverSpeed =
          window.BetterStremio.Player.playbackSpeed;
      } else if (
        [3, 4].includes(window.BetterStremio.Player.state) &&
        BetterStremio.Scopes.loadingBarCtrl.getPlayerState() === "buffering"
      ) {
        BetterStremio.Player.emit("statechanged", {
          state: window.BetterStremio.Player.state,
          NO_SPREAD: true,
        });
      }
    }, window.WatchParty.stateChangedInterval);

    window.WatchParty.styleMap = this.styleMap;
    document.body.insertAdjacentHTML("afterbegin", this.chat());
    this.applyObfuscation();
    const chatInput = this.element("chat-input");

    chatInput.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = chatInput.value;
        if (text) {
          window.WatchParty.sendMessage(text);
          window.WatchParty.chatHistory.push(text);
          window.WatchParty.chatHistoryPointer = 0;
          window.WatchParty.chatLastInput = "";
          chatInput.value = "";
        }
        // arrow up & caret on top of the input should cycle through chat history
      } else if (e.key === "ArrowUp" && chatInput.selectionStart === 0) {
        e.preventDefault();
        if (
          window.WatchParty.chatHistoryPointer <
            window.WatchParty.chatHistory.length
        ) {
          if (window.WatchParty.chatHistoryPointer === 0) {
            window.WatchParty.chatLastInput = chatInput.value;
          }
          chatInput.value = window.WatchParty.chatHistory[
            window.WatchParty.chatHistory.length -
            window.WatchParty.chatHistoryPointer -
            1
          ];
          chatInput.selectionStart = 0;
          chatInput.selectionEnd = 0;
          window.WatchParty.chatHistoryPointer++;
        }
      } else if (
        e.key === "ArrowDown" &&
        chatInput.selectionStart === chatInput.value.length
      ) {
        e.preventDefault();
        if (window.WatchParty.chatHistoryPointer > 0) {
          chatInput.value = window.WatchParty.chatHistory[
            window.WatchParty.chatHistory.length -
            window.WatchParty.chatHistoryPointer +
            1
          ];
          window.WatchParty.chatHistoryPointer--;
          if (window.WatchParty.chatHistoryPointer === 0) {
            chatInput.value = window.WatchParty.chatLastInput;
          }
        }
      }
    };

    const servers = this.wpServers;
    for (const server of Object.values(servers)) {
      const statusEndpoint = server
        .replace("ws://", "http://")
        .replace("wss://", "https://");
      const xhr = new XMLHttpRequest();
      xhr.open("GET", statusEndpoint, true);
      xhr.onload = () => {
        if (xhr.status === 200) {
          console.log("[WatchParty] Server available: ", server);
        }
      };
      xhr.send();
    }

    // Reinjecting WatchParty on state change
    if (!BetterStremio.StremioRoot.wpInjectedStateChange) {
      BetterStremio.StremioRoot.$on(
        "$stateChangeSuccess",
        window.WatchParty.inject,
      );
      BetterStremio.StremioRoot.wpInjectedStateChange = true;
    }

    this.inject();
  }

  /* ---- WatchParty definitions ---- */
  wpServers = {
    H: "wss://mateusaquino-watchparty.hf.space",
    R: "wss://watchparty-kyiy.onrender.com",
    // L: "ws://localhost:3000/",
  };

  pickRandom(partyServer) {
    const servers = this.wpServers;
    const availableServers = Object.keys(servers).filter(
      (server) =>
        server.startsWith(partyServer) &&
        !window.WatchParty.failedServers.includes(servers[server]),
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
    if (window.WatchParty.pingTimeout) {
      clearTimeout(window.WatchParty.pingTimeout);
    }
    if (window.WatchParty.client) {
      window.WatchParty.client.terminate?.() ||
        window.WatchParty.client.close?.();
    }
    const server = this.pickRandom(partyServer);
    if (this.pickRandom("") && !server) {
      document.getElementById("wp-popup").classList.remove("wp-loading");
      document.getElementById("wp-popup").classList.add("wp-noparty");
      return BetterStremio.Toasts.error(
        "Failed to join party.",
        "Invalid party code.",
      );
    }
    if (!server) {
      document.getElementById("wp-popup").classList.remove("wp-loading");
      document.getElementById("wp-popup").classList.add("wp-noparty");
      return BetterStremio.Toasts.error(
        "Failed to create/join party.",
        "Couldn't find any servers available! Wait 60 seconds and try again.",
      );
    }
    window.WatchParty.client = new WebSocket(server, protocol);
    window.WatchParty.client.heartbeat = () => {
      clearTimeout(window.WatchParty.pingTimeout);
      window.WatchParty.pingTimeout = setTimeout(() => {
        console.error("[WatchParty] Connection timeout!");
        BetterStremio.Toasts.error(
          "Disconnected from party!",
          "You have been disconnected due to timeout.",
        );
        window.WatchParty.leave();
      }, 30000 + 4000);
    };
    const retry = () => this.connect(protocol, partyServer);
    window.WatchParty.client.onerror = () => {
      window.WatchParty.failedServers.push(server);
      retry();

      setTimeout(() => {
        const index = window.WatchParty.failedServers.indexOf(server);
        if (index > -1) window.WatchParty.failedServers.splice(index, 1);
      }, 1 * 60 * 1000);
    };
    window.WatchParty.client.onmessage = this.handleMessage;
    window.WatchParty.client.onopen = window.WatchParty.client.heartbeat;

    document.querySelector("#wp-msgs").innerHTML = "";
    window.WatchParty.chatHistory = [];
    window.WatchParty.chatHistoryPointer = 0;
    window.WatchParty.chatLastInput = "";
    this.element("chat").style.display = "flex";

    window.WatchParty.message("", false, true, `You've joined the party`);

    window.WatchParty.client.onclose = () => {
      document.getElementById("wp-popup").classList.remove("wp-loading");
      document.getElementById("wp-popup").classList.add("wp-noparty");
      document.getElementById("wp-chat").style.display = "none";
      console.log("[WatchParty] Connection closed.");
      clearTimeout(window.WatchParty.pingTimeout);
      window.WatchParty.client = undefined;
    };
  }

  inject() {
    if (!window.WatchParty) return;
    if (!BetterStremio.Modules.$state.go.wpInjected) {
      window.WatchParty.uninjectedGo = BetterStremio.Modules.$state.go;
      BetterStremio.Modules.$state.go = function () {
        console.log("[WatchParty] Injecting proxies on go handler...");
        if (arguments[0] === "player/NO_SPREAD") arguments[0] = "player";
        else if (
          arguments[0] === "player" ||
          BetterStremio.Scopes?.playerCtrl?.$state?.current?.name === "player"
        ) {
          window.WatchParty.broadcast("go", Array.from(arguments));
        }

        return window.WatchParty.uninjectedGo.apply(
          window.WatchParty.uninjectedGo,
          arguments,
        );
      };
      BetterStremio.Modules.$state.go.wpInjected = true;
    }

    if (
      BetterStremio.Scopes?.playerControlsCtrl?.playerGoBack &&
      !BetterStremio.Scopes?.playerControlsCtrl?.playerGoBack?.wpInjected
    ) {
      console.log("[WatchParty] Injecting proxies on go back handler...");
      window.WatchParty.uninjectedPlayerGoBack = BetterStremio.Scopes
        ?.playerControlsCtrl?.playerGoBack;
      BetterStremio.Scopes.playerControlsCtrl.playerGoBack = function () {
        window.WatchParty.uninjectedPlayerGoBack.apply(
          window.WatchParty.uninjectedPlayerGoBack,
          arguments,
        );
        if (arguments[0] !== "NO_SPREAD") window.WatchParty.broadcast("goback");
      };
      BetterStremio.Scopes.playerControlsCtrl.playerGoBack.wpInjected = true;
    }

    const device = BetterStremio.Player;

    if (device && !device.wpInjected) {
      console.log("[WatchParty] Injecting proxies on html/mpv player...");
      device.addListener(
        "statechanged",
        window.WatchParty.events.onStateChanged,
      );
      device.addListener("timeupdate", window.WatchParty.events.onTimeUpdate);
      device.addListener("error", window.WatchParty.events.onError);
      device.wpInjected = true;
    }
  }

  onStateChanged(state) {
    setTimeout(() => {
      if (
        state.NO_SPREAD ||
        window.WatchParty.NO_SPREAD ||
        BetterStremio.Player.paused != window.WatchParty.playerObserverPaused
      ) {
        return;
      }
      window.WatchParty.broadcast("state", {
        state,
        time: BetterStremio.Player.time,
        paused: BetterStremio.Player.paused,
        playbackSpeed: BetterStremio.Player.playbackSpeed,
      });
    }, window.WatchParty.stateChangedInterval * 2);
  }

  onTimeUpdate() {
    delete window.WatchParty.NO_SPREAD;
  }

  onError(error) {
    window.WatchParty.broadcast("error", error);
  }

  broadcastCommand(cmd, data) {
    if (window.WatchParty.client && !window.WatchParty.NO_SPREAD) {
      try {
        const dataStr = JSON.stringify(data);
        window.WatchParty.client.send?.(`cmd:${cmd}:${dataStr}`);
      } catch (e) {}
    }
  }

  sendMessage(text) {
    if (window.WatchParty.client) {
      try {
        window.WatchParty.client.send?.(`msg:${text}`);
      } catch (e) {}
    }
  }

  execCommand(latency, cmd, data) {
    console.log("[WatchParty] Executing command:", cmd, data);
    const stateNumber = data ? data.state?.state ?? data.state : undefined;
    if (cmd === "go") {
      const playerData = data;
      playerData.shift();
      BetterStremio.Modules.$state.go("player/NO_SPREAD", ...playerData);
    } else if (cmd === "goback") {
      BetterStremio.Scopes?.playerControlsCtrl?.playerGoBack?.("NO_SPREAD");
    } else if (
      cmd === "state" &&
      BetterStremio.Player &&
      !window.WatchParty.NO_SPREAD &&
      (data.force || ![0, 1, 2, 6].includes(stateNumber))
    ) {
      window.WatchParty.NO_SPREAD = true;
      if (data.playbackSpeed) {
        BetterStremio.Player.playbackSpeed = data.playbackSpeed;
      }

      if (BetterStremio.Player.paused !== data.paused && data.force) {
        BetterStremio.Player.paused = data.paused;
      }

      if (
        Math.abs(data.time - BetterStremio.Player.time) >
          parseInt(latency) * (data.playbackSpeed ?? 1 + 0.1)
      ) {
        BetterStremio.Player.time = data.time + parseInt(latency);
        BetterStremio.Player.paused = data.paused;
        setTimeout(() => delete window.WatchParty.NO_SPREAD, latency);
        return;
      }

      if (
        data.force ||
        ![3, 4].includes(BetterStremio.Player.state) ||
        ![3, 4].includes(data.state.state)
      ) {
        BetterStremio.Player?.emit?.("statechanged", {
          ...data.state,
          NO_SPREAD: true,
        });
      }
      setTimeout(() => delete window.WatchParty.NO_SPREAD, latency);
    }
  }

  handleMessage(message) {
    document.getElementById("wp-popup").classList.remove("wp-loading");
    if (message.data === "ping") {
      window.WatchParty.client.send("pong");
      window.WatchParty.client.heartbeat();
    } else if (message.data === "badroom") {
      document.getElementById("wp-join-pass").value = "";
      BetterStremio.Toasts.error(
        "Failed to join party!",
        "The combination code/password does not exists.",
      );
    } else if (message.data === "upgrade") {
      BetterStremio.Toasts.error(
        "WatchParty version not supported!",
        "Please upgrade your plugin version to use ",
      );
    } else if (message.data.startsWith("party:")) {
      const newParty = JSON.parse(message.data.substring(6));
      if (window.WatchParty.client.party && newParty) {
        const oldMembers = window.WatchParty.client.party.members;
        const newMembers = newParty.members;

        if (oldMembers.length < newMembers.length) {
          const joinedMember = newMembers.find(
            (member) =>
              !oldMembers.map((el) => el.userId).includes(member.userId),
          );
          window.WatchParty.message(
            "",
            false,
            true,
            `${joinedMember.userName}§r has joined the party`,
          );
        } else if (oldMembers.length > newMembers.length) {
          const leftMember = oldMembers.find(
            (member) =>
              !newMembers.map((el) => el.userId).includes(member.userId),
          );
          window.WatchParty.message(
            "",
            false,
            true,
            `${leftMember.userName}§r has left the party`,
          );
        } else {
          for (let i = 0; i < newMembers.length; i++) {
            if (oldMembers[i].isHost !== newMembers[i].isHost) {
              const member = newMembers[i];
              const action = member.isHost ? "promoted to" : "demoted from";
              window.WatchParty.message(
                "",
                false,
                true,
                `${member.userName}§r was ${action} host`,
              );
            }
          }
        }
      }
      window.WatchParty.client.party = newParty;
      const hostIcon =
        `<svg style="margin-right:5px;height:15px" viewBox="0,0,256,256"><g fill="#9370db"><g transform="scale(10.66667,10.66667)"><path d="M12,3c-0.55228,0 -1,0.44772 -1,1c-0.00042,0.32306 0.15527,0.62642 0.41797,0.81445l-3.07227,4.30078l-5.39844,-1.79883c0.03449,-0.10194 0.0523,-0.20879 0.05273,-0.31641c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0,0.55228 0.44772,1 1,1c0.07298,-0.00053 0.14567,-0.00904 0.2168,-0.02539l1.7832,8.02539v4h16v-4l1.7832,-8.02344c0.0712,0.01569 0.14389,0.02355 0.2168,0.02344c0.55228,0 1,-0.44772 1,-1c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0.00044,0.10762 0.01824,0.21446 0.05273,0.31641l-5.39844,1.79883l-3.07422,-4.30273c0.26288,-0.18721 0.41926,-0.48977 0.41992,-0.8125c0,-0.55228 -0.44772,-1 -1,-1zM12,7.44141l2.02539,2.83594l0.85938,1.20313l1.40039,-0.4668l2.99609,-0.99805l-0.88477,3.98438h-12.79297l-0.88477,-3.98633l2.99414,0.99805l1.40039,0.4668l0.85938,-1.20117zM6,16h12v2h-12z"></path></g></g></svg>`;
      const toggleHostIcon =
        `<svg style="height:16px" viewBox="0,0,256,256"><g fill="#fff"><g transform="scale(10.66667,10.66667)"><path d="M12,3c-0.55228,0 -1,0.44772 -1,1c-0.00042,0.32306 0.15527,0.62642 0.41797,0.81445l-3.07227,4.30078l-5.39844,-1.79883c0.03449,-0.10194 0.0523,-0.20879 0.05273,-0.31641c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0,0.55228 0.44772,1 1,1c0.07298,-0.00053 0.14567,-0.00904 0.2168,-0.02539l1.7832,8.02539v4h16v-4l1.7832,-8.02344c0.0712,0.01569 0.14389,0.02355 0.2168,0.02344c0.55228,0 1,-0.44772 1,-1c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0.00044,0.10762 0.01824,0.21446 0.05273,0.31641l-5.39844,1.79883l-3.07422,-4.30273c0.26288,-0.18721 0.41926,-0.48977 0.41992,-0.8125c0,-0.55228 -0.44772,-1 -1,-1zM12,7.44141l2.02539,2.83594l0.85938,1.20313l1.40039,-0.4668l2.99609,-0.99805l-0.88477,3.98438h-12.79297l-0.88477,-3.98633l2.99414,0.99805l1.40039,0.4668l0.85938,-1.20117zM6,16h12v2h-12z"></path></g></g></svg>`;
      const hostCount = newParty.members.filter(
        (member) => member.isHost,
      ).length;
      document.getElementById("wp-popup").classList.remove("wp-noparty");
      document.getElementById("wp-partyname").innerText = newParty.name;
      document.getElementById("wp-partycode").innerText = newParty.code;
      document.getElementById("wp-partymembers").innerHTML = newParty.members
        .map(
          (member) =>
            `<div class="row user-row">
            <span style="display:flex;align-items:center;">${
              member.isHost ? hostIcon : ""
            }${window.WatchParty.mineParse(member.userName)}</span>
            ${
              hostCount > 1 || (hostCount === 1 && !member.isHost)
                ? `<button onclick="WatchParty.toggle('${member.userId}')">${toggleHostIcon}</button>`
                : ""
            }
            </div>`,
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
      const data = jsonData === "undefined" ? undefined : JSON.parse(jsonData);
      window.WatchParty.execute(latency, cmd, data);
    } else if (message.data.startsWith("msg:")) {
      const data = message.data.substring(4);
      const senderId = data.substring(0, data.indexOf(":"));
      const text = data.substring(data.indexOf(":") + 1);
      const sender = window.WatchParty.client.party.members.find(
        (member) => member.userId === senderId,
      );
      window.WatchParty.message(sender.userName, sender.isHost, false, text);
    }
  }

  /* ---- WatchParty UI Methods ---- */
  openUI(toggle = true) {
    if (toggle) {
      this.element("popup").classList.toggle("show");
    } else {
      this.element("popup").classList.remove("show");
    }
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
        element("join-code").value,
      ).toUpperCase();
      const partyPass = encodeURIComponent(element("join-pass").value);
      const protocol = `j#1#${username}#${partyCode}#${partyPass}`;
      this.connect(protocol, partyCode.substring(0, 1));
    }
  }

  control() {
    return `<svg class="icon" viewBox="0,0,256,256"><path d="M 106.56 10.56 C 94.613 10.56 84.171 17.067 78.731 26.88 L 78.4 26.453 C 77.12 26.24 75.744 26.251 74.357 26.251 C 58.997 26.251 46.176 37.013 43.083 51.52 C 35.893 55.467 30.443 62.123 27.957 70.101 C 26.4 70.741 27.093 70.336 24.683 71.307 C 23.029 72.395 22.912 72.491 22.155 73.824 C 21.227 75.072 20.363 77.76 20.789 80.853 L 42.123 235.52 C 42.869 240.853 47.456 244.789 52.789 244.789 L 141.941 244.789 C 142.528 244.896 143.072 245.12 143.691 245.12 L 207.691 245.12 C 213.237 245.12 217.824 240.853 218.357 235.413 L 228.171 122.667 L 234.667 122.667 L 234.667 101.333 L 219.083 101.333 C 218.901 101.323 218.741 101.227 218.56 101.227 L 211.872 101.227 L 215.456 90.56 L 230.837 90.56 L 230.837 69.227 L 207.893 69.227 C 203.307 69.227 199.083 71.467 197.696 75.84 L 197.547 76.267 L 189.248 101.227 L 179.712 101.227 L 181.12 80.416 C 181.333 77.536 180.277 74.677 178.357 72.544 C 177.205 71.328 175.755 70.528 174.208 69.984 C 171.755 62.336 166.571 55.947 159.787 52.064 C 159.253 35.744 146.453 22.507 130.453 21.227 C 124.587 14.72 116.053 10.56 106.56 10.56 Z M 105.813 31.349 C 109.867 31.349 113.291 33.483 115.211 36.789 C 117.344 40.523 121.504 42.656 125.877 42.123 L 127.349 42.123 C 133.216 42.123 138.016 46.816 138.016 52.789 C 138.016 53.856 137.92 54.827 137.707 55.787 C 136.853 58.56 137.28 61.653 138.88 64.213 C 140.16 66.453 142.293 68.064 144.853 68.917 L 56.651 68.917 C 60.917 67.424 63.797 63.253 63.691 58.667 L 63.691 58.357 C 63.691 52.384 68.384 47.691 74.357 47.691 C 76.384 47.691 78.187 48.203 79.787 49.163 C 82.88 50.976 86.709 51.2 90.016 49.6 C 93.216 48 95.467 44.789 95.893 41.269 C 96.533 35.936 99.989 31.349 105.536 31.349 L 105.813 31.349 Z M 43.872 90.357 L 54.56 90.357 L 72.917 223.456 L 62.187 223.456 L 43.872 90.357 Z M 76.107 90.357 L 158.912 90.357 L 158.229 101.227 L 133.227 101.227 C 133.067 101.227 132.917 101.323 132.747 101.333 L 117.333 101.333 L 117.333 122.667 L 123.232 122.667 L 132 223.456 L 94.453 223.456 L 76.107 90.357 Z M 144.853 122.667 L 206.731 122.667 L 197.984 223.893 L 159.456 223.893 L 159.456 223.456 L 153.557 223.456 L 144.853 122.667 Z" style="paint-order: fill; fill: currentColor; stroke: rgb(0, 0, 0); mix-blend-mode: exclusion; stroke-width: 6px;" fill-rule="nonzero" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="none"></path></svg>`;
  }

  chat() {
    return `
    <style type="text/css" id="wp-chat-style">
      #wp-chat {
          flex-direction: column;
          position: fixed;
          bottom: 0;
          right: 0;
          z-index: 999999;
          margin-right: 40px;
          margin-bottom: 120px;
          -webkit-mask-image: -webkit-gradient(linear, left top, left bottom, from(rgba(0, 0, 0, 0)), to(rgba(0, 0, 0, 0.0)));
          display: flex;
          transition: all 0.2s;
          border-radius: 8px;
          padding: 15px;
      }
      
      #wp-chat.wp-received {
          -webkit-mask-image: -webkit-gradient(linear, left top, left bottom, from(rgba(0, 0, 0, 0)), to(rgba(0, 0, 0, 0.6)));
      }

      #wp-chat:hover {
          -webkit-mask-image: -webkit-gradient(linear, left top, left bottom, from(rgba(0, 0, 0, 1)), to(rgba(0, 0, 0, 1))) !important;
          background-color: rgba(0, 0, 0, 0.9);
      }
        
      #wp-chat:hover > * {
        visibility: initial !important;
        transition: all 0.2s;
      }

      #wp-chat:hover > #wp-msgs {
          height: 70vh !important;
          overflow-y: auto;
      }

      #wp-chat > div:last-child {
        display: flex;
        align-items: center;
      }

      #wp-chat > :not(#wp-msgs) {
        visibility: hidden;
      }

      #wp-msgs {
          display: flex;
          flex-direction: column-reverse;
          height: 10vh;
          overflow-y: hidden;
          overflow-x: hidden;
          white-space: pre-wrap;
          width: 25vw;
          transition: all 0.2s;
          margin: 10px 0;
          overflow-wrap: anywhere;
      }

      .wp-msg {
        display: flex;
      }

      .wp-msg-time {
        max-width: 30px;
        min-width: 30px;
        overflow-wrap: normal;
        font-family: monospace;
        font-size: 11px;
        display: flex;
        margin-right: 5px;
        color: gray;
        padding-top: 7px;
      }

      .wp-msg-content {
          display: flex;
          flex-direction: column;
          margin: 4px 0;
      }

      .wp-msg-content > * {
          user-select: text;
          white-space: pre-wrap;
      }

      .wp-msg-content>span:first-child {
          font-weight: bold;
          display: flex;
          align-items: baseline;
      }

      .wp-msg-content>span:first-child>svg {
          height: 15px;
      }

      .wp-sysmsg {
          color: gray;
          text-align: center;
          margin: 10px 0;
      }

      #wp-chat-input {
        bottom: 0;
        position: sticky;
        height: 2.5rem;
        flex-grow: 1;
        width: 10px;
        margin-right: 10px;
        border: 1px solid #252525;
        appearance: none;
        padding: 7px 1rem;
        font-family: PlusJakartaSans, Arial, Helvetica, sans-serif;
        font-size: 1rem;
        font-weight: 500;
        color: rgb(255, 255, 255);
        background-color: rgba(255, 255, 255, 0.05);
        border-radius: 2.5rem;
        outline: none;
        user-select: text;
        overflow-y: auto;
        overflow-x: hidden;
        resize: none;
        display: flex;
      }

      .wp-obfuscated {
        display: inline-block;
        font-family: monospace;
      }

      .wp-picker {
        display: none;
        position: absolute;
        border: 1px solid #252525;
        background: #0c0c0c;
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        grid-template-columns: repeat(5, calc(20% - 4px));
        grid-gap: 5px;
        bottom: 50px;
        left: 20px;
        right: 20px;
    }
      
      .wp-picker button {
        font-size: 20px;
        border: none;
        background: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        color: #fff;
      }

      .wp-picker button:hover {
        background: #222;
      }

      .wp-open-picker {
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        height: 34px;
      }

      .wp-open-picker:hover {
        background: #222;
      }
    </style>

    <div id="wp-chat" style="display: none;">
    <div style="font-weight: 800;text-align: center; margin: 5px 0;">💬 Party Chat</div>
    <div id="wp-msgs"></div>
    <div>
      <textarea id="wp-chat-input" autocomplete="off" onclick="WatchParty.picker('none')"></textarea>
      <svg onclick="WatchParty.picker('format')" class="wp-open-picker" viewBox="0,0,256,256"><g fill="#fff"><g transform="scale(10.66667,10.66667)"><path d="M12,2c-5.759,0 -10.38061,4.86689 -9.97461,10.71289c0.367,5.289 4.98025,9.28711 10.28125,9.28711h0.69336c1.105,0 2,-0.895 2,-2v-3c0,-1.105 0.895,-2 2,-2h3c1.105,0 2,-0.895 2,-2v-0.69336c0,-5.301 -3.99716,-9.91425 -9.28516,-10.28125c-0.24,-0.017 -0.47884,-0.02539 -0.71484,-0.02539zM12,4c0.19,0 0.38122,0.00653 0.57422,0.01953c4.164,0.289 7.42578,3.92911 7.42578,8.28711v0.69336h-3c-2.206,0 -4,1.794 -4,4v3h-0.69336c-4.358,0 -7.99911,-3.26278 -8.28711,-7.42578c-0.156,-2.25 0.59991,-4.3903 2.12891,-6.0293c1.531,-1.641 3.60956,-2.54492 5.85156,-2.54492zM12.5,5c-0.82843,0 -1.5,0.67157 -1.5,1.5c0,0.82843 0.67157,1.5 1.5,1.5c0.82843,0 1.5,-0.67157 1.5,-1.5c0,-0.82843 -0.67157,-1.5 -1.5,-1.5zM8.5,6c-0.82843,0 -1.5,0.67157 -1.5,1.5c0,0.82843 0.67157,1.5 1.5,1.5c0.82843,0 1.5,-0.67157 1.5,-1.5c0,-0.82843 -0.67157,-1.5 -1.5,-1.5zM16.5,7c-0.82843,0 -1.5,0.67157 -1.5,1.5c0,0.82843 0.67157,1.5 1.5,1.5c0.82843,0 1.5,-0.67157 1.5,-1.5c0,-0.82843 -0.67157,-1.5 -1.5,-1.5zM6.5,10c-0.82843,0 -1.5,0.67157 -1.5,1.5c0,0.82843 0.67157,1.5 1.5,1.5c0.82843,0 1.5,-0.67157 1.5,-1.5c0,-0.82843 -0.67157,-1.5 -1.5,-1.5zM10,14c-1.10457,0 -2,0.89543 -2,2c0,1.10457 0.89543,2 2,2c1.10457,0 2,-0.89543 2,-2c0,-1.10457 -0.89543,-2 -2,-2z"></path></g></g></svg>
      <svg onclick="WatchParty.picker('emoji')" class="wp-open-picker" viewBox="0,0,256,256"><g fill="#fff"><g transform="scale(10.66667,10.66667)"><path d="M12,2c-5.523,0 -10,4.477 -10,10c0,5.523 4.477,10 10,10c5.523,0 10,-4.477 10,-10c0,-5.523 -4.477,-10 -10,-10zM12,4c4.418,0 8,3.582 8,8c0,4.418 -3.582,8 -8,8c-4.418,0 -8,-3.582 -8,-8c0,-4.418 3.582,-8 8,-8zM8.5,8c-0.828,0 -1.5,0.672 -1.5,1.5v0.5h3v-0.5c0,-0.828 -0.672,-1.5 -1.5,-1.5zM15.5,8c-0.828,0 -1.5,0.672 -1.5,1.5v0.5h3v-0.5c0,-0.828 -0.672,-1.5 -1.5,-1.5zM6.89063,12c0.8,3.206 2.77938,5.5 5.10938,5.5c2.33,0 4.30937,-2.294 5.10938,-5.5z"></path></g></g></svg>
      <svg onclick="WatchParty.picker('none'); const text = document.getElementById('wp-chat-input').value; if (text) { window.WatchParty.sendMessage(text); document.getElementById('wp-chat-input').value = ''; }" class="wp-open-picker" viewBox="0,0,256,256"><g fill="#ffffff"><g transform="scale(10.66667,10.66667)"><path d="M22,2l-20,7.27148l12.72852,12.72852zM18.65625,5.34375l-4.73437,13.02148l-3.34375,-3.34375l5.05859,-6.6582l-6.6582,5.05859l-3.34375,-3.34375z"></path></g></g></svg>
      <div data-type="format" class="wp-picker" onclick="if (event.target.tagName === 'BUTTON') {const format = event.target.dataset.key;document.getElementById('wp-chat-input').value += format}">
        ${
      Object.entries(window.WatchParty.styleMap)
        .filter(([_k, v]) => v.includes("color"))
        .map(
          ([key, style]) =>
            `<button style="${style}" data-key="${key}">${key}</button>`,
        )
        .join("")
    }
        ${
      Object.entries(window.WatchParty.styleMap)
        .filter(([_k, v]) => !v.includes("color"))
        .map(
          ([key, style]) =>
            `<button data-key="${key}"><span style="pointer-events: none;${style}">${key}</span></button>`,
        )
        .join("")
    }
        <button data-key="§r"><svg style="pointer-events: none;" width="24px" height="24px" viewBox="0,0,256,256"><g fill="#ffffff" ><g transform="scale(10.66667,10.66667)"><path d="M14.65039,2.00586c-0.50455,0 -1.00916,0.18885 -1.38867,0.56836l-10.68555,10.68945c-0.75902,0.75902 -0.75902,2.01833 0,2.77734l5.38477,5.38477c0.42719,0.42719 1.01237,0.60445 1.57813,0.55078v0.02344h12.46094v-2h-9.83594l9.25977,-9.26367c0.75902,-0.75902 0.75902,-2.01833 0,-2.77734l-5.38477,-5.38477c-0.37951,-0.37951 -0.88412,-0.56836 -1.38867,-0.56836zM14.65039,4.01367l5.33398,5.33594l-4.62305,4.62305l-5.33398,-5.33398zM8.61328,10.05273l5.33398,5.33399l-4.59766,4.59961l-5.33398,-5.33594z"></path></g></g></svg></button>
      </div>
      <div data-type="emoji" class="wp-picker" onclick="if (event.target.tagName === 'BUTTON') {const emoji = event.target.textContent;document.getElementById('wp-chat-input').value += emoji}">
        <button>😀</button>
        <button>😂</button>
        <button>😍</button>
        <button>😎</button>
        <button>😜</button>
        <button>😢</button>
        <button>😡</button>
        <button>😇</button>
        <button>😈</button>
        <button>😱</button>
        <button>🤔</button>
        <button>🤣</button>
        <button>🤩</button>
        <button>🤯</button>
        <button>😅</button>
        <button>👍</button>
        <button>👏</button>
        <button>👀</button>
        <button>🎉</button>
        <button>💬</button>
        <button>🔥</button>
        <button>❤️</button>
        <button>💥</button>
        <button>🍿</button>
        <button>🎮</button>
        <button>🎥</button>
        <button>📺</button>
        <button>📽️</button>
        <button>🎬</button>
        <button>🎤</button>
      </div>
    </div>
    </div>`;
  }

  picker(type) {
    document
      .querySelectorAll(".wp-picker")
      .forEach(
        (
          picker,
        ) => (picker.style.display = picker.dataset.type === type
          ? picker.style.display === "grid" ? "none" : "grid"
          : "none"),
      );
  }

  styleMap = {
    "§0": "color:#000000",
    "§1": "color:#0000AA",
    "§2": "color:#00AA00",
    "§3": "color:#00AAAA",
    "§4": "color:#AA0000",
    "§5": "color:#AA00AA",
    "§6": "color:#FFAA00",
    "§7": "color:#AAAAAA",
    "§8": "color:#555555",
    "§9": "color:#5555FF",
    "§a": "color:#55FF55",
    "§b": "color:#55FFFF",
    "§c": "color:#FF5555",
    "§d": "color:#FF55FF",
    "§e": "color:#FFFF55",
    "§f": "color:#FFFFFF",
    "§g": "color:#DDD605",
    "§h": "color:#E3D4D1",
    "§i": "color:#CECACA",
    "§j": "color:#443A3B",
    "§m": "color:#971607",
    "§n": "color:#B4684D",
    "§p": "color:#DEB12D",
    "§q": "color:#47A036",
    "§s": "color:#2CBAA8",
    "§t": "color:#21497B",
    "§u": "color:#9A5CC6",
    "§l": "font-weight:bold",
    "§m": "text-decoration:line-through",
    "§k": "text-decoration:blink",
    "§n": "border-bottom:1px solid",
    "§o": "font-style:italic",
  };

  applyCode(string, codes) {
    const elem = document.createElement("span");
    string = string.replace(/\x00/g, "");
    codes.forEach(
      (code) => (elem.style.cssText += window.WatchParty.styleMap[code] + ";"),
    );
    elem.innerHTML = string;
    return elem;
  }

  applyObfuscation() {
    document
      .querySelectorAll(
        '[style*="text-decoration: blink"],[style*="text-decoration:blink"]',
      )
      .forEach((span) => {
        const originalText = span.textContent;
        span.classList.add("wp-obfuscated");

        const randomChar = (c) => {
          if (c === " " || c === "\n") return c;
          const chars = "Ili!:;.".includes(c)
            ? "Ili!:;."
            : "1234567890abcdefghjkmnopqrstuvwxyz~@#$%^&*()-=_+{}[]";
          return chars[Math.floor(Math.random() * chars.length)];
        };

        const interval = setInterval(() => {
          if (span.parentNode) {
            span.textContent = originalText
              .split("")
              .map((c) => randomChar(c))
              .join("");
          } else clearInterval(interval);
        }, 70);
      });
  }

  mineParse(text) {
    let string = text.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "§r";
    const finalPre = document.createElement("pre"),
      codes = string.match(/§.{1}/g) || [],
      codesLen = codes.length,
      indexes = [];
    let indexDelta,
      apply = [],
      strSlice;

    for (let i = 0; i < codesLen; i++) {
      indexes.push(string.indexOf(codes[i]));
      string = string.replace(codes[i], "\x00\x00");
    }

    if (indexes[0] !== 0) {
      finalPre.appendChild(
        window.WatchParty.applyCode(string.substring(0, indexes[0]), []),
      );
    }

    for (let i = 0; i < codesLen; i++) {
      indexDelta = indexes[i + 1] - indexes[i];
      if (indexDelta === 2) {
        while (indexDelta === 2) {
          apply.push(codes[i]);
          i++;
          indexDelta = indexes[i + 1] - indexes[i];
        }
        apply.push(codes[i]);
      } else apply.push(codes[i]);
      if (apply.lastIndexOf("§r") > -1) {
        apply = apply.slice(apply.lastIndexOf("§r") + 1);
      }

      strSlice = string.substring(indexes[i], indexes[i + 1]);
      finalPre.appendChild(window.WatchParty.applyCode(strSlice, apply));
    }
    const parseAnchor = (str) =>
      str.replace(
        /((?:(http|https|Http|Https|rtsp|Rtsp):\/\/(?:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,64}(?:\:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,25})?\@)?)?((?:(?:[a-zA-Z0-9][a-zA-Z0-9\-]{0,64}\.)+(?:(?:aero|arpa|asia|a[cdefgilmnoqrstuwxz])|(?:biz|b[abdefghijmnorstvwyz])|(?:cat|com|coop|c[acdfghiklmnoruvxyz])|d[ejkmoz]|(?:edu|e[cegrstu])|f[ijkmor]|(?:gov|g[abdefghilmnpqrstuwy])|h[kmnrtu]|(?:info|int|i[delmnoqrst])|(?:jobs|j[emop])|k[eghimnrwyz]|l[abcikrstuvy]|(?:mil|mobi|museum|m[acdghklmnopqrstuvwxyz])|(?:name|net|n[acefgilopruz])|(?:org|om)|(?:pro|p[aefghklmnrstwy])|qa|r[eouw]|s[abcdeghijklmnortuvyz]|(?:tel|travel|t[cdfghjklmnoprtvwz])|u[agkmsyz]|v[aceginu]|w[fs]|y[etu]|z[amw]))|(?:(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9])\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[0-9])))(?:\:\d{1,5})?)(\/(?:(?:[a-zA-Z0-9\;\/\?\:\@\&\=\#\~\-\.\+\!\*\'\(\)\,\_])|(?:\%[a-fA-F0-9]{2}))*)?(?:\b|$)/gi,
        (x) =>
          '<a style="color:#9370db" target="_blank" href="' +
          x +
          '">' +
          x +
          "</a>",
      );
    return parseAnchor(finalPre.innerHTML);
  }

  message(username, isHost, isSystem, text) {
    const safeUsername = window.WatchParty.mineParse(username);
    const safeText = window.WatchParty.mineParse(text);
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const icon = isHost
      ? `<svg style="margin-right: 5px;" viewBox="0,0,256,256"><g fill="#9370db"><g transform="scale(10.66667,10.66667)"><path d="M12,3c-0.55228,0 -1,0.44772 -1,1c-0.00042,0.32306 0.15527,0.62642 0.41797,0.81445l-3.07227,4.30078l-5.39844,-1.79883c0.03449,-0.10194 0.0523,-0.20879 0.05273,-0.31641c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0,0.55228 0.44772,1 1,1c0.07298,-0.00053 0.14567,-0.00904 0.2168,-0.02539l1.7832,8.02539v4h16v-4l1.7832,-8.02344c0.0712,0.01569 0.14389,0.02355 0.2168,0.02344c0.55228,0 1,-0.44772 1,-1c0,-0.55228 -0.44772,-1 -1,-1c-0.55228,0 -1,0.44772 -1,1c0.00044,0.10762 0.01824,0.21446 0.05273,0.31641l-5.39844,1.79883l-3.07422,-4.30273c0.26288,-0.18721 0.41926,-0.48977 0.41992,-0.8125c0,-0.55228 -0.44772,-1 -1,-1zM12,7.44141l2.02539,2.83594l0.85938,1.20313l1.40039,-0.4668l2.99609,-0.99805l-0.88477,3.98438h-12.79297l-0.88477,-3.98633l2.99414,0.99805l1.40039,0.4668l0.85938,-1.20117zM6,16h12v2h-12z"></path></g></g></svg>`
      : "";

    const messageHtml = isSystem
      ? `<div class="wp-sysmsg"><span>${safeText}</span></div>`
      : `<div class="wp-msg"><span class="wp-msg-time">${time}</span><div class="wp-msg-content"><span>${icon}${safeUsername}</span><span>${safeText}</span></div></div>`;

    document
      .querySelector("#wp-msgs")
      .insertAdjacentHTML("afterbegin", messageHtml);
    window.WatchParty.applyObfuscation();
    document.querySelector("#wp-chat").classList.add("wp-received");
    clearTimeout(window.WatchParty.receivedMsgTimeout);
    window.WatchParty.receivedMsgTimeout = setTimeout(
      () => document.querySelector("#wp-chat").classList.remove("wp-received"),
      4000,
    );
  }

  popup() {
    return `
    <h3>WatchParty <span>v${this.getVersion()}</span></h3>
    
    <button id="wp-create-btn" class="wp-noparty-show selected" onclick="WatchParty.create()">Create</button>
    <button id="wp-join-btn" class="wp-noparty-show" onclick="WatchParty.join()">Join</button>

    <div id="wp-create" class="tab">
      <div class="row">Username: <input id="wp-create-user" oninput="BetterStremio.Data.store('WatchParty', 'user', this.value)" value="${
      BetterStremio.Data.read("WatchParty", "user") || ""
    }" autocomplete="off" type="text"/></div>
      <div class="row">Party Name: <input id="wp-create-name" oninput="BetterStremio.Data.store('WatchParty', 'party', this.value)" value="${
      BetterStremio.Data.read("WatchParty", "party") || "Watch Party"
    }" autocomplete="off" type="text"/></div>
      <div class="row">Party Pass: <input type="password" id="wp-create-pass" oninput="BetterStremio.Data.store('WatchParty', 'pass', this.value)" value="${
      BetterStremio.Data.read("WatchParty", "pass") || ""
    }" autocomplete="off" type="text"/></div>
      <div class="row">New members as host: <input id="wp-create-joinashost" onchange="BetterStremio.Data.store('WatchParty', 'joinAsHost', this.checked)" ${
      BetterStremio.Data.read("WatchParty", "joinAsHost") === "true"
        ? "checked"
        : ""
    } autocomplete="off" type="checkbox"/></div>
    </div>

    <div id="wp-join" class="tab hidden">
      <div class="row">Username: <input id="wp-join-user" oninput="BetterStremio.Data.store('WatchParty', 'user', this.value)" value="${
      BetterStremio.Data.read("WatchParty", "user") || ""
    }" autocomplete="off" type="text"/></div>
      <div class="row">Party Code: <input id="wp-join-code" autocomplete="off" type="text"/></div>
      <div class="row">Party Pass: <input type="password" id="wp-join-pass" oninput="BetterStremio.Data.store('WatchParty', 'pass', this.value)" value="${
      BetterStremio.Data.read("WatchParty", "pass") || ""
    }" autocomplete="off" type="text"/></div>
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
        height: 46px;
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

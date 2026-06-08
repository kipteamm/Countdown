"use strict";
function getCookie(name) {
    const cookieString = document.cookie;
    const cookies = cookieString.split(';');
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name)
            return cookieValue;
    }
    return null;
}
var GameState;
(function (GameState) {
    GameState[GameState["WAITING"] = 0] = "WAITING";
    GameState[GameState["NEW_ROUND"] = 1] = "NEW_ROUND";
})(GameState || (GameState = {}));
function _toState(name) {
    if (name === "waiting")
        return GameState.WAITING;
    if (name === "new-round")
        return GameState.NEW_ROUND;
    throw new TypeError(name);
}
class GameController {
    constructor() {
        this.stateParents = {};
        document.querySelectorAll(".state").forEach((elm) => {
            const HTMLelm = elm;
            this.stateParents[_toState(HTMLelm.dataset.state)] = HTMLelm;
        });
        // Player management
        this.players = document.getElementById("players");
        socket.on("player_join", (player) => this.playerJoin(player));
        socket.on("player_leave", (player) => this.playerLeave(player));
        // Rounds
        socket.on("round_new", (data) => this.newRound(data));
        socket.on("connect", () => {
            console.log("CONNECTED");
            if (isHost)
                return;
            this.notifyReady();
        });
    }
    notifyReady() {
        console.log("READY");
        socket.emit("ready", getCookie("ut"));
    }
    playerJoin(player) {
        console.log(player);
        if (player.player_id === PLAYER.player_id)
            return;
        GAME.players.push(player);
        this.updatePlayers();
    }
    playerLeave(player) {
        GAME.players.splice(GAME.players.indexOf(player), 1);
        this.updatePlayers();
    }
    updatePlayers() {
        console.log(GAME.players);
        this.players.innerHTML = "";
        GAME.players.forEach(player => {
            this.players.innerHTML += `<li>${player.username}${player.player_id === PLAYER.player_id ? " (You)" : ""}</li>`;
        });
        if (!isHost)
            return;
        const canStart = GAME.players.length === GAME.team_size * 2;
        this.players.innerHTML += `
            <button onclick="game.notifyReady()"${canStart ? "" : " disabled"}>${!canStart && GAME.team_size === 2 ? "Start with random teams" : "Start"}</button>
        `;
    }
    newRound(data) {
        console.log(data);
    }
}
const socket = io("", {
    transports: ["websocket"],
    auth: { token: getCookie("ut") },
});
const isHost = GAME.creator.player_id === PLAYER.player_id;
let game;
window.addEventListener("load", () => {
    game = new GameController();
});

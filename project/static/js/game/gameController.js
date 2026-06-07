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
class GameController {
    constructor() {
        // Player management
        this.players = document.getElementById("players");
        socket.on("player_join", (player) => this.playerJoin(player));
        socket.on("player_leave", (player) => this.playerLeave(player));
        socket.on("new_round", (data) => this.newRound(data));
    }
    notifyReady() {
        console.log("THIS CLIENT READY");
        socket.emit("ready", GAME.token);
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
        this.players.innerHTML = "";
        GAME.players.forEach(player => {
            this.players.innerHTML += `<li>${player.username}${player.player_id === PLAYER.player_id ? " (You)" : ""}</li>`;
        });
        if (!isHost)
            return;
        this.players.innerHTML += `<button onclick="game.notifyReady()"${GAME.players.length === 4 ? "" : " disabled"}>Start</button>`;
    }
    newRound(data) {
    }
}
const socket = io("", {
    transports: ["websocket"],
    auth: { token: getCookie("ut"), game: true },
});
const isHost = GAME.creator.player_id === PLAYER.player_id;
let game;
window.addEventListener("load", () => {
    game = new GameController();
    if (isHost)
        return;
    game.notifyReady();
});

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
    GameState[GameState["ROUND_NEW"] = 1] = "ROUND_NEW";
    GameState[GameState["ROUND_LETTERS"] = 2] = "ROUND_LETTERS";
    GameState[GameState["ROUND_NUMBERS"] = 3] = "ROUND_NUMBERS";
    GameState[GameState["ROUND_CONUNDRUM"] = 4] = "ROUND_CONUNDRUM";
    GameState[GameState["ROUND_COUNTDOWN"] = 5] = "ROUND_COUNTDOWN";
    GameState[GameState["ROUND_ANSWER"] = 6] = "ROUND_ANSWER";
})(GameState || (GameState = {}));
function _toState(name) {
    if (name === "waiting")
        return GameState.WAITING;
    if (name === "round-new")
        return GameState.ROUND_NEW;
    if (name === "round-letters")
        return GameState.ROUND_LETTERS;
    if (name === "round-numbers")
        return GameState.ROUND_NUMBERS;
    if (name === "round-conundrum")
        return GameState.ROUND_CONUNDRUM;
    throw new TypeError(name);
}
function playerName(id) {
    for (const player of GAME.players) {
        if (player.player_id !== id)
            continue;
        return player.username;
    }
    throw new TypeError(id.toString());
}
class GameController {
    constructor() {
        this.stateParents = {};
        this.state = GameState.WAITING;
        this.btn = null;
        this.entities = null;
        this.gameData = null;
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
        socket.on("round_start", (data) => this.roundStart(data));
        socket.on("round_entity", (data) => this.roundEntity(data));
        socket.on("round_target", (data) => this.roundTarget(data));
        socket.on("round_countdown", () => this.roundCountdown());
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
    updateState(state) {
        this.stateParents[this.state].classList.remove("active");
        this.state = state;
        this.stateParents[this.state].classList.add("active");
    }
    newRound(data) {
        const isLetters = data.game_mode === 0;
        const state = isLetters ? GameState.ROUND_LETTERS : GameState.ROUND_NUMBERS;
        const parent = this.stateParents[GameState.ROUND_NEW];
        const everyone = data.player_12 !== null;
        console.log(data);
        if (state === GameState.ROUND_LETTERS) {
            parent.innerHTML = `
                <h2>It is ${playerName(data.starting_player)} turn to pick the letters.</h2>
                <b>This game is played by ${everyone ? "everyone" : `${playerName(data.player_11)} and ${playerName(data.player_21)}`}.</b>
                <p>
                    ${playerName(data.starting_player)} will begin with picking (at least) 3 vowels and 4 constenants. 
                    It is then to ${everyone ? "you" : `${playerName(data.player_11)} and ${playerName(data.player_21)}`} to form the
                    longest possible, existing English word with the provided letters.
                <p>
            `;
        }
        else if (state == GameState.ROUND_NUMBERS) {
            parent.innerHTML = `
                <h2>${playerName(data.starting_player)} has to pick the numbers.</h2>
                <b>This game is played by ${everyone ? "everyone" : `${playerName(data.player_11)} and ${playerName(data.player_21)}`}.</b>
                <p>
                    ${playerName(data.starting_player)} has to pick 6 random numbers.
                    Large numbers consist of 25, 50, 75 and 100, and small numbers are 1 through 10.
                    A random target will be given which you will have to reach by using only ×, +, - and ÷.
                <p>
            `;
        }
        this.updateState(GameState.ROUND_NEW);
    }
    roundStart(data) {
        const isLetters = data.game_mode === 0;
        const state = isLetters ? GameState.ROUND_LETTERS : GameState.ROUND_NUMBERS;
        console.log(data);
        this.gameData = data.game_data;
        this.updateState(state);
        // Make options available to starting player
        if (data.starting_player !== PLAYER.player_id)
            return;
        this.stateParents[this.state].classList.add("starting");
    }
    roundEntity(data) {
        var _a, _b, _c, _d, _e, _f;
        this.entities = (this.entities || document.getElementById((this.state === GameState.ROUND_LETTERS ? "letter" : "number") + "-entities"));
        if (this.state === GameState.ROUND_LETTERS) {
            const prevLength = ((_b = (_a = this.gameData) === null || _a === void 0 ? void 0 : _a.letters) === null || _b === void 0 ? void 0 : _b.length) || 0;
            const newLetters = data.letters.slice(prevLength);
            for (const letter of newLetters) {
                this.entities.innerHTML += `<div class="entity">${letter}</div>`;
            }
        }
        else {
            const prevLargeLength = ((_d = (_c = this.gameData) === null || _c === void 0 ? void 0 : _c.large) === null || _d === void 0 ? void 0 : _d.length) || 0;
            const newLarge = data.large.slice(prevLargeLength);
            for (const number of newLarge) {
                this.entities.innerHTML += `<div class="entity">${number}</div>`;
            }
            const prevSmallLength = ((_f = (_e = this.gameData) === null || _e === void 0 ? void 0 : _e.small) === null || _f === void 0 ? void 0 : _f.length) || 0;
            const newSmall = data.small.slice(prevSmallLength);
            for (const number of newSmall) {
                this.entities.innerHTML += `<div class="entity">${number}</div>`;
            }
        }
        this.gameData = data;
        if (!this.btn)
            return;
        this.btn.disabled = false;
    }
    roundTarget(target) {
        document.getElementById("number-target").innerText = target.toString();
    }
    roundCountdown() {
        console.log("counting down");
    }
    roundPick(type, btn) {
        this.btn = btn;
        this.btn.disabled = true;
        socket.emit("round_pick", { token: getCookie("ut"), type: type });
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

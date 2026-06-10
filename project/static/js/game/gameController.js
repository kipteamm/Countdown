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
    GameState[GameState["ROUND_VERIFY"] = 7] = "ROUND_VERIFY";
    GameState[GameState["ROUND_REPLIES"] = 8] = "ROUND_REPLIES";
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
    if (name === "round-replies")
        return GameState.ROUND_REPLIES;
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
        this.team1 = null;
        this.team2 = null;
        this.game = null;
        this.replies = [];
        this.btn = null;
        this.entities = null;
        this.gameData = null;
        this.currentRule = null;
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
        socket.on("round_answer", () => this.roundAnswer());
        socket.on("round_end", () => this.roundEnd());
        socket.on("round_verify", (data) => this.roundVerify(data));
        socket.on("round_result", (data) => this.roundResults(data));
        socket.on("round_replies", (data) => { this.replies = data; });
        // Game
        socket.on("game_start", (data) => this.startGame(data));
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
    updateTeam() {
        this.team1.innerHTML = `<div>${GAME.team_1.map(user => user.username).join('<br>')}</div><b>${GAME.team_1_points}</b>`;
        this.team2.innerHTML = `<div>${GAME.team_2.map(user => user.username).join('<br>')}</div><b>${GAME.team_2_points}</b>`;
    }
    startGame(data) {
        GAME = data;
        this.team1 = (this.team1 || document.getElementById("team-1"));
        this.team2 = (this.team2 || document.getElementById("team-2"));
        this.updateTeam();
    }
    updateState(state) {
        this.stateParents[this.state].classList.remove("active");
        this.state = state;
        console.log(`[STATE] ${state}`);
        this.stateParents[this.state].classList.add("active");
    }
    getGameMode(mode) {
        switch (mode) {
            case 0: return GameState.ROUND_LETTERS;
            case 1: return GameState.ROUND_NUMBERS;
            case 2: return GameState.ROUND_CONUNDRUM;
        }
        throw new TypeError(mode.toString());
    }
    newRound(data) {
        this.game = this.getGameMode(data.game_mode);
        const parent = this.stateParents[GameState.ROUND_NEW];
        const everyone = data.player_12 !== null;
        console.log(data);
        if (this.game === GameState.ROUND_LETTERS) {
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
        else if (this.game == GameState.ROUND_NUMBERS) {
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
        else {
            parent.innerHTML = `
                <h2>Time for todays Crucial Countdown Conundrum!</h2>
                <b>This game is played by everyone.</b> 
                <p>
                    The rules are simple: we are looking for a nine-letter word. 
                    It'll appear on the board in a completely scrambled-up fashion.
                </p>
            `;
        }
        this.updateState(GameState.ROUND_NEW);
    }
    roundStart(data) {
        const state = this.getGameMode(data.game_mode);
        console.log(data);
        this.gameData = data.game_data;
        this.updateState(state);
        if (this.game === GameState.ROUND_CONUNDRUM) {
            document.getElementById("conundrum-guess").focus();
            this.entities = document.getElementById("conundrum-entities");
            const conundrum = this.gameData.conundrum[0];
            for (const letter of conundrum.split("")) {
                this.entities.innerHTML += `<div class="entity">${letter}</div>`;
            }
            return;
        }
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
                this.entities.innerHTML += `<div class="entity" onclick="game.verifyToggle(this, false)">${number}</div>`;
            }
            const prevSmallLength = ((_f = (_e = this.gameData) === null || _e === void 0 ? void 0 : _e.small) === null || _f === void 0 ? void 0 : _f.length) || 0;
            const newSmall = data.small.slice(prevSmallLength);
            for (const number of newSmall) {
                this.entities.innerHTML += `<div class="entity" onclick="game.verifyToggle(this, false)">${number}</div>`;
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
        this.stateParents[this.state].classList.remove("starting");
        startCountdown();
    }
    roundAnswer() {
        document.getElementById("submit").classList.add("active");
        document.querySelector("#submit input").focus();
    }
    roundEnd() {
        console.log("SENDING ANSWER");
        document.getElementById("submit").classList.remove("active");
        const input = document.querySelector("#submit input");
        const answer = input.value;
        socket.emit("answer", { token: getCookie("ut"), answer: answer });
        input.value = "";
    }
    roundVerify(data) {
        this.state = GameState.ROUND_VERIFY;
        if (data !== PLAYER.player_id) {
            document.getElementById("verifying").classList.add("active");
            return;
        }
        document.body.classList.add("verify");
        setTimeout(() => {
            document.body.classList.remove("verify");
            socket.emit("verify", { token: getCookie("ut"), rules: this.getRules() });
        }, 20 * 1000);
    }
    reset() {
        this.team1.innerHTML = "";
        this.team2.innerHTML = "";
        this.updateTeam();
        document.getElementById("number-target").innerText = "000";
        document.querySelectorAll(".rule").forEach(elm => {
            if (elm.id !== "no-remove")
                this.releaseRule(elm);
        });
        this.entities.innerHTML = "";
        this.entities = null;
        this.state = this.game;
    }
    endGame(playerId, conundrum) {
        if (typeof conundrum == "number")
            return;
        let revealTimout = 0;
        if (playerId > 0) {
            const conundrumReveal = document.getElementById("conundrum");
            conundrumReveal.innerHTML = `<h2>${playerId === PLAYER.player_id ? "Correct!" : `${playerName(playerId)} guessed it correctly!`}</h2>`;
            revealTimout = 3000;
        }
        setTimeout(() => {
            this.entities.innerHTML = "";
            for (const char of conundrum.split("")) {
                this.entities.innerHTML += `<div class="entity">${char}</div>`;
            }
        }, revealTimout);
        setTimeout(() => {
            const parent = this.stateParents[GameState.ROUND_REPLIES];
            parent.innerHTML = "<h2>Final scores</h2>";
            parent.innerHTML += `<div>${GAME.team_1.map(player => { player.username; }).join(" & ")} got: <b>${GAME.team_1_points}</b></div>`;
            parent.innerHTML += `<div>${GAME.team_2.map(player => { player.username; }).join(" & ")} got: <b>${GAME.team_2_points}</b></div>`;
        }, 4000 + revealTimout);
    }
    roundResults(data) {
        console.log(data);
        if (this.state === GameState.ROUND_VERIFY) {
            document.getElementById("verifying").classList.remove("active");
            document.body.classList.remove("verify");
        }
        for (const entry of data) {
            if (entry[1] === 1) {
                GAME.team_1_points += entry[2];
                continue;
            }
            GAME.team_2_points += entry[2];
        }
        if (this.state === GameState.ROUND_CONUNDRUM)
            return this.endGame(data[0][0], data[0][3]);
        this.reset();
        this.revealReplies();
        if (GAME.creator.player_id !== PLAYER.player_id)
            return;
        setTimeout(() => {
            console.log("NEXT ROUND");
            socket.emit("next", getCookie("ut"));
        }, 5000);
    }
    revealReplies() {
        const parent = this.stateParents[GameState.ROUND_REPLIES];
        parent.innerHTML = "<h2>Let's see what everyone got...</h2>";
        this.updateState(GameState.ROUND_REPLIES);
        setTimeout(() => {
            for (const entry of this.replies) {
                parent.innerHTML += `<div>${playerName(entry[0])} got <b>${entry[3]}</b></div>`;
            }
            if (!this.replies) {
                parent.innerHTML += `<div>No one got anything</div>`;
            }
        }, 800);
    }
    getRules() {
        const rules = [];
        //@ts-ignore
        for (const elm of document.getElementById("rules").children) {
            rules.push(elm.getAttribute("data-equation"));
        }
        return rules;
    }
    roundPick(type, btn) {
        this.btn = btn;
        this.btn.disabled = true;
        socket.emit("pick", { token: getCookie("ut"), type: type });
    }
    releaseRule(ruleElm) {
        if (!ruleElm)
            return;
        const numberPool = document.getElementById("number-entities");
        const ruleElmsContainer = ruleElm.querySelector(".entities");
        const childrenArray = Array.from(ruleElmsContainer.children);
        childrenArray.forEach((child) => {
            const htmlChild = child;
            const text = htmlChild.innerText;
            const isOperator = ["+", "-", "×", "÷"].includes(text);
            if (isOperator) {
                htmlChild.remove();
            }
            else {
                htmlChild.setAttribute("onclick", "game.verifyToggle(this, false)");
                numberPool.appendChild(htmlChild);
            }
        });
        const ruleString = ruleElm.getAttribute("data-equation");
        if (ruleString) {
            const generatedResultElm = numberPool.querySelector(`[data-from-rule="${ruleString}"]`);
            if (generatedResultElm) {
                generatedResultElm.remove();
            }
        }
        ruleElm.remove();
    }
    addRule() {
        this.currentRule = (this.currentRule || document.getElementById("current-rule"));
        if (this.currentRule.childElementCount < 3)
            return;
        let rule = "";
        //@ts-ignore
        for (const elm of this.currentRule.children) {
            const value = elm.innerText.replace("×", "*").replace("÷", "/");
            rule += value;
        }
        const result = eval(rule);
        if (!Number.isInteger(result) || result < 0)
            return;
        const elm = document.createElement("div");
        elm.setAttribute("onclick", "game.verifyToggle(this, false)");
        elm.classList.add("entity");
        elm.innerText = result;
        elm.setAttribute("data-from-rule", rule);
        document.getElementById("number-entities").appendChild(elm);
        const ruleElms = document.createElement("div");
        ruleElms.classList.add("entities");
        const childrenArray = Array.from(this.currentRule.children);
        for (const child of childrenArray) {
            child.removeAttribute("onclick");
            ruleElms.appendChild(child);
        }
        const ruleElm = document.createElement("div");
        ruleElm.classList.add("rule");
        ruleElm.setAttribute("data-equation", rule);
        ruleElm.appendChild(ruleElms);
        const releaseElm = document.createElement("div");
        releaseElm.classList.add("entity");
        releaseElm.innerText = "#";
        releaseElm.setAttribute("onclick", "game.releaseRule(this.parentElement)");
        ruleElm.appendChild(releaseElm);
        document.getElementById("rules").appendChild(ruleElm);
    }
    verifyToggle(elm, isOperator) {
        this.currentRule = (this.currentRule || document.getElementById("current-rule"));
        const isAlreadyInWorkspace = elm.parentElement === this.currentRule;
        if (isAlreadyInWorkspace) {
            const numberPool = document.getElementById("number-entities");
            const elementsToRemove = [];
            let nextSibling = elm.nextElementSibling;
            while (nextSibling) {
                elementsToRemove.push(nextSibling);
                nextSibling = nextSibling.nextElementSibling;
            }
            for (const trailingElm of elementsToRemove) {
                const isTrailingOperator = ["+", "-", "×", "÷"].includes(trailingElm.innerText);
                if (isTrailingOperator) {
                    trailingElm.remove();
                }
                else {
                    numberPool.appendChild(trailingElm);
                }
            }
            if (isOperator) {
                elm.remove();
            }
            else {
                numberPool.appendChild(elm);
            }
            return;
        }
        const currentLength = this.currentRule.childElementCount;
        if (currentLength === 0) {
            if (isOperator)
                return;
        }
        else if (currentLength === 1) {
            if (!isOperator)
                return;
        }
        else if (currentLength === 2) {
            if (isOperator)
                return;
        }
        else
            return;
        if (isOperator) {
            this.currentRule.appendChild(elm.cloneNode(true));
        }
        else {
            this.currentRule.appendChild(elm);
        }
    }
    guessConundrum(btn) {
        const guess = document.getElementById("conundrum-guess").value;
        socket.emit("guess", { token: getCookie("ut"), guess: guess });
        let timer = 5;
        btn.disabled = true;
        btn.innerText = `${timer}..`;
        const id = setInterval(() => {
            timer -= 1;
            btn.innerText = `${timer}..`;
            if (timer > 0)
                return;
            clearInterval(id);
            btn.innerText = "Make guess";
            btn.disabled = false;
        }, 1000);
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

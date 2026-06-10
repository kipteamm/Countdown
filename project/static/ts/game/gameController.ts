declare const PLAYER: PlayerData;
declare let GAME: Game;

declare const io: any;

type emit = {
    (event: string, data: Object | string): void;
}
type on = {
    (event: string, data: Object | string): void;
}

interface Socket {
    emit: emit;
    on: on;
}


interface PlayerData {
    player_id: number;
    username: string;
}

interface Game {
    token: string;
    team_size: number;
    creator: PlayerData;
    team_1: PlayerData[];
    team_1_points: number;
    team_2: PlayerData[];
    team_2_points: number;
    players: PlayerData[];
}

type GameData = Record<string, number[] | string[]>;

interface Round {
    round_number: number;
    game_mode: number; 
    starting_team: number;
    starting_player: number;
    game_data: GameData;

    player_11: number;
    player_12: number | null;
    player_21: number;
    player_22: number | null;
}

function getCookie(name: string) {
    const cookieString = document.cookie;
    const cookies = cookieString.split(';');

    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name) return cookieValue;
    }

    return null;
}


enum GameState {
    WAITING,
    ROUND_NEW,
    ROUND_LETTERS,
    ROUND_NUMBERS,
    ROUND_CONUNDRUM,
    ROUND_COUNTDOWN,
    ROUND_ANSWER,
    ROUND_VERIFY,
    ROUND_REPLIES,
}

function _toState(name: string): GameState {
    if (name === "waiting") return GameState.WAITING;
    if (name === "round-new") return GameState.ROUND_NEW;
    if (name === "round-letters") return GameState.ROUND_LETTERS;
    if (name === "round-numbers") return GameState.ROUND_NUMBERS;
    if (name === "round-conundrum") return GameState.ROUND_CONUNDRUM;
    if (name === "round-replies") return GameState.ROUND_REPLIES;
    throw new TypeError(name);
}

function playerName(id: number): string {
    for (const player of GAME.players) {
        if (player.player_id !== id) continue
        return player.username;
    }
    throw new TypeError(id.toString());
}


class GameController {
    private players: HTMLElement;
    private stateParents: Record<GameState, HTMLElement> = {} as Record<GameState, HTMLElement>;
    private state: GameState = GameState.WAITING;

    private team1: HTMLElement | null = null;
    private team2: HTMLElement | null = null;
    
    private game: GameState | null = null;
    private replies: number[][] = [];

    private btn: HTMLButtonElement | null = null;
    private entities: HTMLElement | null = null;
    private gameData: GameData | null = null;
    
    private currentRule: HTMLElement | null = null;

    constructor() {
        document.querySelectorAll(".state").forEach((elm) => {
            const HTMLelm = (elm as HTMLElement)
            this.stateParents[_toState(HTMLelm.dataset.state!)] = HTMLelm;
        });

        // Player management
        this.players = document.getElementById("players")!;
        socket.on("player_join", (player: PlayerData) => this.playerJoin(player));
        socket.on("player_leave", (player: PlayerData) => this.playerLeave(player));

        // Rounds
        socket.on("round_new", (data: Round) => this.newRound(data))
        socket.on("round_start", (data: Round) => this.roundStart(data))
        socket.on("round_entity", (data: GameData) => this.roundEntity(data));
        socket.on("round_target", (data: number)=> this.roundTarget(data));
        socket.on("round_countdown", () => this.roundCountdown());
        socket.on("round_answer", () => this.roundAnswer());
        socket.on("round_end", () => this.roundEnd());
        socket.on("round_verify", (data: number) => this.roundVerify(data));
        socket.on("round_result", (data: number[][]) => this.roundResults(data));
        socket.on("round_replies", (data: number[][]) => { this.replies = data; });

        // Game
        socket.on("game_start", (data: Game) => this.startGame(data));
        socket.on("connect", () => {
            console.log("CONNECTED");
            if (isHost) return; 

            this.notifyReady();
        });
    }

    private notifyReady(): void {
        console.log("READY");
        socket.emit("ready", getCookie("ut")!);
    }

    private playerJoin(player: PlayerData): void {
        console.log(player);
        if (player.player_id === PLAYER.player_id) return;
        GAME.players.push(player);

        this.updatePlayers();
    }
    
    private playerLeave(player: PlayerData): void {
        GAME.players.splice(GAME.players.indexOf(player), 1);
        this.updatePlayers();
    }

    private updatePlayers(): void {
        console.log(GAME.players);

        this.players.innerHTML = "";
        GAME.players.forEach(player => {
            this.players.innerHTML += `<li>${player.username}${player.player_id === PLAYER.player_id? " (You)": ""}</li>`;
        });

        if (!isHost) return;
        const canStart = GAME.players.length === GAME.team_size * 2;

        this.players.innerHTML += `
            <button onclick="game.notifyReady()"${canStart? "": " disabled"}>${!canStart && GAME.team_size === 2? "Start with random teams": "Start"}</button>
        `;
    }

    private updateTeam(): void {
        this.team1!.innerHTML = `<div>${GAME.team_1.map(user => user.username).join('<br>')}</div><b>${GAME.team_1_points}</b>`;
        this.team2!.innerHTML = `<div>${GAME.team_2.map(user => user.username).join('<br>')}</div><b>${GAME.team_2_points}</b>`;
    }

    private startGame(data: Game): void {
        GAME = data;
        
        this.team1 = (this.team1 || document.getElementById("team-1"!));
        this.team2 = (this.team2 || document.getElementById("team-2"!));

        this.updateTeam();
    }

    private updateState(state: GameState): void {
        this.stateParents[this.state].classList.remove("active");
        this.state = state;
        console.log(`[STATE] ${state}`)
        this.stateParents[this.state].classList.add("active");
    }

    private getGameMode(mode: number): GameState {
        switch (mode) {
            case 0: return GameState.ROUND_LETTERS;
            case 1: return GameState.ROUND_NUMBERS;
            case 2: return GameState.ROUND_CONUNDRUM;
        }

        throw new TypeError(mode.toString());
    }

    private newRound(data: Round): void {
        this.game = this.getGameMode(data.game_mode)

        const parent = this.stateParents[GameState.ROUND_NEW];
        const everyone = data.player_12 !== null

        console.log(data)

        if (this.game === GameState.ROUND_LETTERS) {
            parent.innerHTML = `
                <h2>It is ${playerName(data.starting_player)} turn to pick the letters.</h2>
                <b>This game is played by ${everyone? "everyone": `${playerName(data.player_11)} and ${playerName(data.player_21)}`}.</b>
                <p>
                    ${playerName(data.starting_player)} will begin with picking (at least) 3 vowels and 4 constenants. 
                    It is then to ${everyone? "you": `${playerName(data.player_11)} and ${playerName(data.player_21)}`} to form the
                    longest possible, existing English word with the provided letters.
                <p>
            `;
        } else if (this.game == GameState.ROUND_NUMBERS) {
            parent.innerHTML = `
                <h2>${playerName(data.starting_player)} has to pick the numbers.</h2>
                <b>This game is played by ${everyone? "everyone": `${playerName(data.player_11)} and ${playerName(data.player_21)}`}.</b>
                <p>
                    ${playerName(data.starting_player)} has to pick 6 random numbers.
                    Large numbers consist of 25, 50, 75 and 100, and small numbers are 1 through 10.
                    A random target will be given which you will have to reach by using only ×, +, - and ÷.
                <p>
            `;
        } else {
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

    private roundStart(data: Round): void {
        const state = this.getGameMode(data.game_mode);

        console.log(data);

        this.gameData = data.game_data;
        this.updateState(state);

        if (this.game === GameState.ROUND_CONUNDRUM) {
            (document.getElementById("conundrum-guess") as HTMLInputElement).focus();

            this.entities = document.getElementById("conundrum-entities")!;
            const conundrum = (this.gameData.conundrum[0] as string);

            for (const letter of conundrum.split("")) {
                this.entities.innerHTML += `<div class="entity">${letter}</div>`;
            }

            return;
        }

        // Make options available to starting player
        if (data.starting_player !== PLAYER.player_id) return;
        this.stateParents[this.state].classList.add("starting");
    }

    private roundEntity(data: GameData): void {
        this.entities = (this.entities || document.getElementById((this.state === GameState.ROUND_LETTERS ? "letter" : "number") + "-entities")!);

        if (this.state === GameState.ROUND_LETTERS) {
            const prevLength = this.gameData?.letters?.length || 0;
            const newLetters = (data.letters as string[]).slice(prevLength);

            for (const letter of newLetters) {
                this.entities.innerHTML += `<div class="entity">${letter}</div>`;
            }
        } else {
            const prevLargeLength = this.gameData?.large?.length || 0;
            const newLarge = (data.large as number[]).slice(prevLargeLength);

            for (const number of newLarge) {
                this.entities.innerHTML += `<div class="entity" onclick="game.verifyToggle(this, false)">${number}</div>`;
            }

            const prevSmallLength = this.gameData?.small?.length || 0;
            const newSmall = (data.small as number[]).slice(prevSmallLength);

            for (const number of newSmall) {
                this.entities.innerHTML += `<div class="entity" onclick="game.verifyToggle(this, false)">${number}</div>`;
            }
        }

        this.gameData = data;

        if (!this.btn) return;
        this.btn.disabled = false;
    }

    private roundTarget(target: number): void {
        document.getElementById("number-target")!.innerText = target.toString();
    }

    private roundCountdown(): void {
        this.stateParents[this.state].classList.remove("starting");
        startCountdown();
    }

    private roundAnswer(): void {
        document.getElementById("submit")!.classList.add("active");
        (document.querySelector("#submit input") as HTMLInputElement).focus();
    }

    private roundEnd(): void {
        console.log("SENDING ANSWER")

        document.getElementById("submit")!.classList.remove("active");
        const input = document.querySelector("#submit input") as HTMLInputElement
        const answer = input.value;

        socket.emit("answer", {token: getCookie("ut")!, answer: answer});
        input.value = "";
    }

    private roundVerify(data: number): void {
        this.state = GameState.ROUND_VERIFY;

        if (data !== PLAYER.player_id) {
            document.getElementById("verifying")!.classList.add("active");
            return;
        }

        document.body.classList.add("verify");

        setTimeout(() => {
            document.body.classList.remove("verify");
            socket.emit("verify", {token: getCookie("ut")!, rules: this.getRules()});
        }, 20 * 1000);
    }

    public reset(): void {
        this.team1!.innerHTML = "";
        this.team2!.innerHTML = "";

        this.updateTeam();

        document.getElementById("number-target")!.innerText = "000";
        document.querySelectorAll(".rule").forEach(elm => {
            if (elm.id !== "no-remove") this.releaseRule((elm as HTMLElement));
        });

        this.entities!.innerHTML = "";
        this.entities = null;

        this.state = this.game!;
    }

    private endGame(playerId: number, conundrum: string | number): void {
        if (typeof conundrum == "number") return;
        let revealTimout = 0;

        if (playerId > 0) {
            const conundrumReveal = document.getElementById("conundrum");
            conundrumReveal!.innerHTML = `<h2>${playerId === PLAYER.player_id? "Correct!": `${playerName(playerId)} guessed it correctly!`}</h2>`;
            revealTimout = 3000;
        }

        setTimeout(() => {
            this.entities!.innerHTML = "";
            for (const char of conundrum.split("")) {
                this.entities!.innerHTML += `<div class="entity">${char}</div>`;
            }
        }, revealTimout);

        setTimeout(() => {
            const parent = this.stateParents[GameState.ROUND_REPLIES];
            parent.innerHTML = "<h2>Final scores</h2>";

            parent.innerHTML += `<div>${GAME.team_1.map(player => { player.username }).join(" & ")} got: <b>${GAME.team_1_points}</b></div>`;
            parent.innerHTML += `<div>${GAME.team_2.map(player => { player.username }).join(" & ")} got: <b>${GAME.team_2_points}</b></div>`;
        }, 4000 + revealTimout);
    }

    private roundResults(data: number[][]): void {
        console.log(data);

        if (this.state === GameState.ROUND_VERIFY) {
            document.getElementById("verifying")!.classList.remove("active");
            document.body.classList.remove("verify");
        }

        for (const entry of data) {
            if (entry[1] === 1) {
                GAME.team_1_points += entry[2];
                continue;
            }
            GAME.team_2_points += entry[2];
        }

        if (this.state === GameState.ROUND_CONUNDRUM) return this.endGame(data[0][0], data[0][3]);

        this.reset();
        this.revealReplies();
        
        if (GAME.creator.player_id !== PLAYER.player_id) return;
        setTimeout(() => {
            console.log("NEXT ROUND");
            socket.emit("next", getCookie("ut")!);
        }, 5000);
    }

    private revealReplies(): void {
        const parent = this.stateParents[GameState.ROUND_REPLIES];
        parent.innerHTML = "<h2>Let's see what everyone got...</h2>";
        
        this.updateState(GameState.ROUND_REPLIES);

        setTimeout(() => {
            for (const entry of this.replies) {
                parent.innerHTML += `<div>${playerName(entry[0])} got <b>${entry[3]}</b></div>`
            }
            if (!this.replies) {
                parent.innerHTML += `<div>No one got anything</div>`;
            }
        }, 800);
    }

    private getRules(): string[] {
        const rules: string[] = [];

        //@ts-ignore
        for (const elm of document.getElementById("rules")!.children) {
            rules.push(elm.getAttribute("data-equation")!);
        }

        return rules;
    }
    
    public roundPick(type: number, btn: HTMLButtonElement): void {
        this.btn = btn;
        this.btn.disabled = true;
        socket.emit("pick", {token: getCookie("ut")!, type: type});
    }

    public releaseRule(ruleElm: HTMLElement): void {
        if (!ruleElm) return;

        const numberPool = document.getElementById("number-entities")!;
        const ruleElmsContainer = ruleElm.querySelector(".entities")!;        
        const childrenArray = Array.from(ruleElmsContainer.children);

        childrenArray.forEach((child) => {
            const htmlChild = child as HTMLElement;
            const text = htmlChild.innerText;

            const isOperator = ["+", "-", "×", "÷"].includes(text);

            if (isOperator) {
                htmlChild.remove();
            } else {
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

    public addRule() {
        this.currentRule = (this.currentRule || document.getElementById("current-rule")!);

        if (this.currentRule.childElementCount < 3) return;
        let rule = "";
        
        //@ts-ignore
        for (const elm of this.currentRule.children) {
            const value = (elm as HTMLElement).innerText.replace("×", "*").replace("÷", "/");
            rule += value;
        }

        const result = eval(rule);
        if (!Number.isInteger(result) || result < 0) return;
        
        const elm = document.createElement("div");
        elm.setAttribute("onclick", "game.verifyToggle(this, false)");
        elm.classList.add("entity");
        elm.innerText = result;
        elm.setAttribute("data-from-rule", rule); 
        document.getElementById("number-entities")!.appendChild(elm);

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

        document.getElementById("rules")!.appendChild(ruleElm);        
    }

   public verifyToggle(elm: HTMLElement, isOperator: boolean): void {
        this.currentRule = (this.currentRule || document.getElementById("current-rule")!);
        
        const isAlreadyInWorkspace = elm.parentElement === this.currentRule;
        
        if (isAlreadyInWorkspace) {
            const numberPool = document.getElementById("number-entities")!;
            
            const elementsToRemove: HTMLElement[] = [];
            let nextSibling = elm.nextElementSibling as HTMLElement;
            
            while (nextSibling) {
                elementsToRemove.push(nextSibling);
                nextSibling = nextSibling.nextElementSibling as HTMLElement;
            }

            for (const trailingElm of elementsToRemove) {
                const isTrailingOperator = ["+", "-", "×", "÷"].includes(trailingElm.innerText);
                
                if (isTrailingOperator) {
                    trailingElm.remove();
                } else {
                    numberPool.appendChild(trailingElm);
                }
            }

            if (isOperator) {
                elm.remove();
            } else {
                numberPool.appendChild(elm);
            }
            
            return;
        }

        const currentLength = this.currentRule.childElementCount;
        if (currentLength === 0) {
            if (isOperator) return;
        } 
        else if (currentLength === 1) {
            if (!isOperator) return;
        } 
        else if (currentLength === 2) {
            if (isOperator) return;
        } 
        else return;

        if (isOperator) {
            this.currentRule.appendChild(elm.cloneNode(true));
        } else {
            this.currentRule.appendChild(elm);
        }
    }

    public guessConundrum(btn: HTMLButtonElement): void {
        const guess = (document.getElementById("conundrum-guess") as HTMLInputElement).value;
        socket.emit("guess", {token: getCookie("ut"), guess: guess}!);

        let timer = 5;
        btn.disabled = true;
        btn.innerText = `${timer}..`;

        const id = setInterval(() => {
            timer -= 1;
            btn.innerText = `${timer}..`;
            
            if (timer > 0) return;
            clearInterval(id);
            btn.innerText = "Make guess";
            btn.disabled = false;
        }, 1000);
    }
}


const socket: Socket = io("", {
    transports: ["websocket"],
    auth: { token: getCookie("ut") },
});

const isHost = GAME.creator.player_id === PLAYER.player_id;
let game: GameController;
window.addEventListener("load", () => {
    game = new GameController();
});

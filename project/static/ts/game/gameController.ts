declare const PLAYER: PlayerData;
declare const GAME: GameData;

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

interface GameData {
    token: string;
    team_size: number;
    creator: PlayerData;
    players: PlayerData[];
}

interface NewRound {
    round_number: number;
    game_mode: number; 
    starting_team: number;
    starting_player: number;

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
    ROUND_CONUNDRUM
}

function _toState(name: string): GameState {
    if (name === "waiting") return GameState.WAITING;
    if (name === "round-new") return GameState.ROUND_NEW;
    if (name === "round-letters") return GameState.ROUND_LETTERS;
    if (name === "round-numbers") return GameState.ROUND_NUMBERS;
    if (name === "round-conundrum") return GameState.ROUND_CONUNDRUM;
    throw new TypeError(name);
}

function playerName(id: number): string {
    GAME.players.forEach(player => {
        if (player.player_id === id) return player.username;
    });
    throw new TypeError(id.toString());
}


class GameController {
    private players: HTMLElement;
    private stateParents: Record<GameState, HTMLElement> = {} as Record<GameState, HTMLElement>;
    private state: GameState = GameState.WAITING;

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
        socket.on("round_new", (data: NewRound) => this.newRound(data))

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

    private updateState(state: GameState): void {
        this.stateParents[this.state].classList.remove("active");
        this.state = state;
        this.stateParents[this.state].classList.add("active");
    }

    private newRound(data: NewRound): void {
        const isLetters = data.game_mode === 0;
        const state = isLetters? GameState.ROUND_LETTERS: GameState.ROUND_NUMBERS
        const parent = this.stateParents[GameState.ROUND_NEW];
        const everyone = data.player_12 !== null

        console.log(data)

        if (state === GameState.ROUND_LETTERS) {
            parent.innerHTML = `
                <h2>It is ${playerName(data.starting_player)} turn to pick the letters.</h2>
                <b>This game is played by ${everyone? "everyone": `${playerName(data.player_11)} and ${playerName(data.player_21)}`}.</b>
                <p>
                    ${playerName(data.starting_player)} will begin with picking (at least) 3 vowels and 4 constenants. 
                    It is then to ${everyone? "you": `${playerName(data.player_11)} and ${playerName(data.player_21)}`} to form the
                    longest possible, existing English word with the provided letters.
                <p>
            `;
        } else if (state == GameState.ROUND_NUMBERS) {
            parent.innerHTML = `
                <h2>${playerName(data.starting_player)} has to pick the numbers.</h2>
                <b>This game is played by ${everyone? "everyone": `${playerName(data.player_11)} and ${playerName(data.player_21)}`}.</b>
                <p>
                    ${playerName(data.starting_player)} has the choice to pick 6 numbers out of any row.
                    The top row are big numbers, the rest are random small ones. At least one big
                    number must be picked.
                <p>
            `;
        }

        this.updateState(state);
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

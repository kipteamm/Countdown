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
    starting_player: string;

    player_11: string;
    player_12: string | null;
    player_21: string;
    player_22: string | null;
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
    NEW_ROUND
}

function _toState(name: string): GameState {
    if (name === "waiting") return GameState.WAITING;
    if (name === "new-round") return GameState.NEW_ROUND;
    throw new TypeError(name);
}


class GameController {
    private players: HTMLElement;
    private stateParents: Record<GameState, HTMLElement> = {} as Record<GameState, HTMLElement>;

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


    private newRound(data: NewRound): void {
        console.log(data);
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

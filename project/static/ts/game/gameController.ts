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
    creator: PlayerData;
    players: PlayerData[];
}

interface NewRound {

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


class GameController {
    private players: HTMLElement;

    constructor() {
        // Player management
        this.players = document.getElementById("players")!;
        socket.on("player_join", (player: PlayerData) => this.playerJoin(player));
        socket.on("player_leave", (player: PlayerData) => this.playerLeave(player));

        socket.on("new_round", (data: NewRound) => this.newRound(data))
    }

    notifyReady(): void {
        console.log("THIS CLIENT READY");
        socket.emit("ready", GAME.token);
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
        this.players.innerHTML = "";
        GAME.players.forEach(player => {
            this.players.innerHTML += `<li>${player.username}${player.player_id === PLAYER.player_id? " (You)": ""}</li>`;
        });

        if (!isHost) return;
        this.players.innerHTML += `<button onclick="game.notifyReady()"${GAME.players.length === 4? "": " disabled"}>Start</button>`
    }


    private newRound(data: NewRound): void {

    }
}


const socket: Socket = io("", {
    transports: ["websocket"],
    auth: { token: getCookie("ut"), game: true },
});

const isHost = GAME.creator.player_id === PLAYER.player_id;
let game: GameController;
window.addEventListener("load", () => {
    game = new GameController();
    
    if (isHost) return;
    game.notifyReady();
});

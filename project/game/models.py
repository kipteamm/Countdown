from project.auth.models import AnonymousUserDict, AnonymousUser
from project.extensions import cache, socketio

import typing as t 
import enum as e
import secrets
import random


class GameState(e.Enum):
    WAITING = 0
    ROUND_NEW = 1
    ROUND_LETTERS = 2
    ROUND_NUMBERS = 3
    ROUND_CONUNDRUM = 4


class RoundDict(t.TypedDict):
    round_number: int
    game_mode: int      # 0 is letters 1 is numbers
    starting_team: int
    starting_player: int

    player_11: int
    player_12: int | None
    player_21: int
    player_22: int | None
    game_data: dict | None


class RoomDict(t.TypedDict):
    id: str
    token: str
    team_size: int

    state: str
    round_number: int
    round: RoundDict

    creator_id: str
    player_ids: list[str]
    team_1_ids: list[str]
    team_2_ids: list[str]


class Room:
    id: str
    token: str
    team_size: int

    state: GameState
    round_number: int
    round: RoundDict

    creator: AnonymousUser
    players: list[AnonymousUser]
    team_1: list[AnonymousUser]
    team_2: list[AnonymousUser]

    def __init__(self, team_size: int, creator: AnonymousUser) -> None:
        self.id = str(random.randint(100000, 999999))
        self.token = secrets.token_urlsafe(32)
        self.team_size = team_size

        self.state = GameState.WAITING
        self.round_number = 0
        # Assure to be set when calling .start()
        self.round = {} # type: ignore

        self.players = []
        self.team_1 = []
        self.team_2 = []

        self.creator = creator
        self.add_player(creator)

        self.save()

    @classmethod
    def get(cls, id: str | None) -> "Room | None":
        if not id: return
        
        room = cache.get(id)
        if not room: return

        return Room.from_cache(room)
    
    @classmethod
    def from_cache(cls, data: RoomDict) -> "Room":
        room = cls.__new__(cls)

        for field, value in data.items():
            if field == "creator_id":
                room.creator = AnonymousUser.get(data["creator_id"], True)
                continue

            if field == "player_ids":
                room.players = [AnonymousUser.get(id, True) for id in data["player_ids"]]
                continue
            
            if field == "team_1_ids":
                room.team_1 = [AnonymousUser.get(id, True) for id in data["team_1_ids"]]
                continue
            
            if field == "team_2_ids":
                room.team_2 = [AnonymousUser.get(id, True) for id in data["team_2_ids"]]
                continue

            if field == "state":
                room.state = GameState[value] # type: ignore
                continue

            setattr(room, field, value)
        
        return room
    
    def add_player(self, player: AnonymousUser) -> bool:
        if len(self.players) == self.team_size * 2:
            player.room_id = None
            return False
        
        if not player in self.players:
            player.player_id = len(self.players)
            self.players.append(player)

            socketio.emit("player_join", player.serialize_player(), to=self.id)
        
        player.room_id = self.id
        return True
    
    def start(self) -> None:
        random.shuffle(self.players)
        
        # ASSUMPTION: If one team is not set, the other is also not set
        if not self.team_1:
            if self.team_size == 1:
                self.team_1 = [self.players[0]]
                self.team_2 = [self.players[1]]
            else:
                self.team_1 = [self.players[0], self.players[1]]
                self.team_2 = [self.players[2], self.players[3]]

        
        self.round = {
            "game_mode": round(random.random()),
            "round_number": -1, "starting_team": round(random.random()) + 1,
            "starting_player": t.cast(int, random.choice(self.players).player_id),
            "player_11": t.cast(int, self.team_1[0].player_id), "player_12": self.team_1[1].player_id if self.team_size == 2 else None,
            "player_21": t.cast(int, self.team_2[0].player_id), "player_22": self.team_2[1].player_id if self.team_size == 2 else None,
            "game_data": None
        }
    

    def _letters_round(self) -> dict:
        return {
            "letters": []
        }
    
    def _numbers_round(self) -> dict:
        return {
            "large": [],
            "small": []
        }

    def _all_round(self) -> None:
        ids = [player.player_id for player in self.players]

        new_round: RoundDict = {
            "game_mode": int(not self.round["game_mode"]),
            "round_number": self.round_number,
            "starting_team": ((self.round["starting_team"] + 1) % 2) + 1,
            "starting_player": t.cast(int, ids[(ids.index(self.round["starting_player"]) + 1) % len(ids)]),
            "player_11": t.cast(int, self.team_1[0].player_id), "player_12": self.team_1[1].player_id if self.team_size == 2 else None,
            "player_21": t.cast(int, self.team_2[0].player_id), "player_22": self.team_2[1].player_id if self.team_size == 2 else None,
            "game_data": None
        }

        socketio.emit("round_new", new_round, to=self.id)
        self.round = new_round

    def _specific_round(self) -> None:
        pass

    def _conundrum(self) -> None:
        pass
    
    def prepare_next_round(self) -> None:
        self.state = GameState.ROUND_NEW

        # Both games are played (in random order in a 2v2 manner)
        if self.round_number < 2:
            self._all_round()

        # This depends on whether is a 1v1 or a 2v2
        # In a 1v1 this is more of the same, in a 2v2 these are two random rounds
        # where two different opponents face each other
        if self.round_number < 4:
            if self.team_size == 1: self._all_round()
            else: self._specific_round()

        # This depends on whether it is a 1v1 or a 2v2
        # 1v1 ends here with a conundrum, 2v2 continues with anohter general round
        if self.team_size == 1:
            return self._conundrum()

        if self.round_number < 6:
            self._all_round()

        else:
            return self._conundrum()

        if self.round["game_mode"] == 0:
            self.round["game_data"] = self._letters_round()

        if self.round["game_mode"] == 1:
            self.round["game_data"] = self._numbers_round()


    def save(self) -> None:
        cache.set(self.id, self.serialize(), timeout=12 * 60 * 60)

    def serialize(self) -> RoomDict:
        return {
            "id": self.id,
            "token": self.token,
            "team_size": self.team_size,
            "round_number": self.round_number,
            "round": self.round,
            "state": self.state.name,
            "creator_id": self.creator.id,
            "player_ids": [player.id for player in self.players],
            "team_1_ids": [player.id for player in self.team_1],
            "team_2_ids": [player.id for player in self.team_2],
        }
    
    def serialize_game(self) -> dict[str, t.Any]:
        return {
            "token": self.token,
            "team_size": self.team_size,
            "state": self.state.name,
            "creator": self.creator.serialize_player(),
            "players": [player.serialize_player() for player in self.players]
        }

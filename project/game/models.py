from project.auth.models import AnonymousUserDict, AnonymousUser
from project.extensions import cache, socketio

import typing as t 
import enum as e
import secrets
import random


class GameState(e.Enum):
    WAITING = 0


class RoomDict(t.TypedDict):
    id: str
    token: str
    team_size: int
    state: str

    creator: AnonymousUserDict
    players: list[AnonymousUserDict]


class Room:
    id: str
    token: str
    team_size: int
    state: GameState

    creator: AnonymousUser
    players: list[AnonymousUser] = []
    team_1: list[AnonymousUser]
    team_2: list[AnonymousUser]

    def __init__(self, team_size: int, creator: AnonymousUser) -> None:
        self.id = str(random.randint(100000, 999999))
        self.token = secrets.token_urlsafe(32)

        self.team_size = team_size
        self.state = GameState.WAITING

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
        room = cls(data["team_size"], AnonymousUser.from_cache(data["creator"]))
        room.id = data["id"]
        room.token = data["token"]
        room.players = [AnonymousUser.from_cache(player) for player in data["players"]]
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

    def save(self) -> None:
        cache.set(self.id, self.serialize(), timeout=12 * 60 * 60)

    def serialize(self) -> RoomDict:
        return {
            "id": self.id,
            "token": self.token,
            "team_size": self.team_size,
            "state": self.state.name,
            "creator": self.creator.serialize(),
            "players": [player.serialize() for player in self.players]
        }
    
    def serialize_game(self) -> dict[str, t.Any]:
        return {
            "token": self.token,
            "team_size": self.team_size,
            "state": self.state.name,
            "creator": self.creator.serialize_player(),
            "players": [player.serialize_player() for player in self.players]
        }

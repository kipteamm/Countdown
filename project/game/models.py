from project.auth.models import AnonymousUserDict, AnonymousUser
from project.extensions import cache, socketio

import typing as t 
import secrets
import random


class RoomDict(t.TypedDict):
    id: str
    token: str
    creator: AnonymousUserDict
    players: list[AnonymousUserDict]


class Room:
    id: str
    token: str

    creator: AnonymousUser
    players: list[AnonymousUser] = []

    def __init__(self, creator: AnonymousUser) -> None:
        self.id = str(random.randint(100000, 999999))
        self.token = secrets.token_urlsafe(32)
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
        room = cls(AnonymousUser.from_cache(data["creator"]))
        room.id = data["id"]
        room.token = data["token"]
        room.players = [AnonymousUser.from_cache(player) for player in data["players"]]
        return room
    
    def add_player(self, player: AnonymousUser) -> None:
        if not player in self.players:
            player.player_id = len(self.players)
            self.players.append(player)

            socketio.emit("player_join", player.serialize_player(), to=self.id)
        
        player.room_id = self.id

    def save(self) -> None:
        cache.set(self.id, self.serialize(), timeout=12 * 60 * 60)

    def serialize(self) -> RoomDict:
        return {
            "id": self.id,
            "token": self.token,
            "creator": self.creator.serialize(),
            "players": [player.serialize() for player in self.players]
        }
    
    def serialize_game(self) -> dict[str, t.Any]:
        return {
            "token": self.token,
            "creator": self.creator.serialize_player(),
            "players": [player.serialize_player() for player in self.players]
        }

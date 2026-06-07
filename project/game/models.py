from project.auth.models import AnonymousUserDict, AnonymousUser
from project.extensions import cache

import typing as t 
import random


class RoomDict(t.TypedDict):
    id: str
    creator: AnonymousUserDict
    players: list[AnonymousUserDict]


class Room:
    id: str
    creator: AnonymousUser
    players: list[AnonymousUser]

    def __init__(self, creator: AnonymousUser) -> None:
        self.id = str(random.randint(100000, 999999))
        self.creator = creator
        self.players = [creator]

        self.save()

    @classmethod
    def get(cls, id: str) -> "Room | None":
        room = cache.get(id)
        if not room: return

        return Room.from_cache(room)
    
    @classmethod
    def from_cache(cls, data: RoomDict) -> "Room":
        room = cls(AnonymousUser.from_cache(data["creator"]))
        room.id = data["id"]
        room.players = [AnonymousUser.from_cache(player) for player in data["players"]]
        return room
    
    def add_player(self, player: AnonymousUser) -> None:
        if not player in self.players:
            self.players.append(player)
        
        player.room_id = self.id

    def save(self) -> None:
        cache.set(self.id, self.serialize(), timeout=12 * 60 * 60)

    def serialize(self) -> RoomDict:
        return {
            "id": self.id,
            "creator": self.creator.serialize(),
            "players": [player.serialize() for player in self.players]
        }
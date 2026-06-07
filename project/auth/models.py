from project.extensions import db, cache

from sqlalchemy.orm import Mapped, mapped_column
from flask_login import UserMixin

import typing as t
import secrets


class AnonymousUserDict(t.TypedDict):
    id: str
    name: str

    player_id: int | None
    room_id: str | None
    ready: bool


class AnonymousUser(UserMixin):
    id: str
    name: str

    player_id: int | None = None
    room_id: str | None = None
    ready: bool = False

    def __init__(self, name: str) -> None:
        self.id = secrets.token_urlsafe(64)
        self.name = name

    @classmethod
    def from_cache(cls, data: AnonymousUserDict) -> "AnonymousUser":
        user = cls(data["name"])

        for key, value in data.items():
            if key == "name": continue
            setattr(user, key, value)

        return user

    def save(self) -> None:
        cache.set(self.id, self.serialize(), timeout=2 * 60 * 60)

    def serialize(self) -> AnonymousUserDict:
        return {
            "id": self.id,
            "name": self.name,
            "player_id": self.player_id,
            "room_id": self.room_id,
            "ready": self.ready
        }
    
    def serialize_player(self) -> dict[str, int | str]:
        assert self.player_id != None, "IMPOSSIBLE"
        return {
            "player_id": self.player_id, "name": self.name
        }


class User(db.Model, AnonymousUser): 
    id = db.Column(db.String(128), primary_key=True)
    name = db.Column(db.String(30))
    email: Mapped[str] = mapped_column(unique=True)

    def save(self) -> None:
        db.session.commit()

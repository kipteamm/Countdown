from project.extensions import db, cache

from sqlalchemy.orm import Mapped, mapped_column
from flask_login import UserMixin

import typing as t
import secrets


class AnonymousUserDict(t.TypedDict):
    id: str
    username: str

    player_id: int | None
    room_id: str | None
    team_id: int | None
    ready: bool
    answer: str | int | None


class AnonymousUser(UserMixin):
    id: str
    username: str

    player_id: int | None = None
    room_id: str | None = None
    team_id: int | None = None
    ready: bool = False
    answer: str | int | None = None

    def __init__(self, username: str) -> None:
        self.id = secrets.token_urlsafe(64)
        self.username = username

    @t.overload
    @classmethod
    def get(cls, token: str) -> "AnonymousUser | None": ...

    @t.overload
    @classmethod
    def get(cls, token: str, certain: t.Literal[True]) -> "AnonymousUser": ...

    @classmethod
    def get(cls, token: str, certain: bool = False) -> "AnonymousUser | None":
        user = cache.get(token)
        if not user: return

        return cls.from_cache(user)

    @classmethod
    def from_cache(cls, data: AnonymousUserDict) -> "AnonymousUser":
        user = cls.__new__(cls)

        for key, value in data.items():
            setattr(user, key, value)

        return user

    def save(self) -> None:
        cache.set(self.id, self.serialize(), timeout=2 * 60 * 60)

    def serialize(self) -> AnonymousUserDict:
        return {
            "id": self.id,
            "username": self.username,
            "player_id": self.player_id,
            "room_id": self.room_id,
            "team_id": self.team_id,
            "ready": self.ready,
            "answer": self.answer
        }
    
    def serialize_player(self) -> dict[str, int | str]:
        assert self.player_id != None, "IMPOSSIBLE"
        return {
            "player_id": self.player_id, "username": self.username
        }


class User(db.Model, AnonymousUser): 
    id = db.Column(db.String(128), primary_key=True)
    username = db.Column(db.String(30))
    email: Mapped[str] = mapped_column(unique=True)

    def save(self) -> None:
        db.session.commit()

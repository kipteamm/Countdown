from project.extensions import db, cache

from sqlalchemy.orm import Mapped, mapped_column
from flask_login import UserMixin
from dataclasses import dataclass

import typing as t


class AnonymousUserDict(t.TypedDict):
    id: str
    name: str
    room_id: str | None


@dataclass
class AnonymousUser(UserMixin):
    id: str
    name: str

    room_id: str | None = None

    @classmethod
    def from_cache(cls, data: AnonymousUserDict) -> "AnonymousUser":
        user = cls(data["id"], data["name"])
        user.room_id = data.get("room_id")
        return user

    def save(self) -> None:
        cache.set(self.id, self.serialize(), timeout=2 * 60 * 60)

    def serialize(self) -> AnonymousUserDict:
        return {
            "id": self.id,
            "name": self.name,
            "room_id": self.room_id
        }


class User(db.Model, AnonymousUser): 
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(30))
    email: Mapped[str] = mapped_column(unique=True)

    def save(self) -> None:
        db.session.commit()

from project.auth.models import AnonymousUser
from project.game.models import Room
from project.extensions import cache

from flask_socketio import SocketIO, join_room, leave_room
from flask import request


playing_users = {}


def register_events(socketio: SocketIO):
    @socketio.on("connect")
    def handle_connect(auth: dict):
        token: str | None = None
        if auth and "token" in auth:
            token = auth["token"]

        if not token: return
        user: AnonymousUser | None = AnonymousUser.get(token)

        if not user: return
        playing_users[user.id] = user
        user.ready = True
        user.save()

        join_room(user.room_id)
        room = Room.get(user.room_id)

        if not room: return print("IMPOSSIBLE")

        for player in room.players:
            if not player.ready: return

        socketio.emit("new_round", to=room.id)

    
    @socketio.on("disconnect")
    def handle_disconnect():
        pass

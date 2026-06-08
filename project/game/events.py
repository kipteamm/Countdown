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

        join_room(user.room_id)
        

    @socketio.on("disconnect")
    def handle_disconnect():
        pass
    

    @socketio.on("ready")
    def handle_ready(token: str):
        user: AnonymousUser | None = AnonymousUser.get(token)
        if not user: return

        user.ready = True
        user.save()

        room = Room.get(user.room_id)

        if not room: return print("IMPOSSIBLE")

        print(room.players)
        for player in room.players:
            print(player.serialize())
            if not player.ready: return

        room.start()
        room.next_round()
        room.save()

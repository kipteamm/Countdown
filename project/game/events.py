from project.auth.models import AnonymousUser
from project.game.models import Room, RoomDict, GameState
from project.extensions import socketio, cache

from flask_socketio import SocketIO, join_room, leave_room
from flask import request


playing_users = {}


def start_next_round(room: RoomDict) -> None:
    socketio.sleep(20)

    socketio.emit("round_start", room["round"], to=room["id"])

    if room["round"]["game_mode"] == 0:
        room["state"] = GameState.ROUND_LETTERS.name
    
    elif room["round"]["game_mode"] == 1:
        room["state"] = GameState.ROUND_NUMBERS.name
    
    else:
        room["state"] = GameState.ROUND_CONUNDRUM.name
    
    cache.set(room["id"], room, timeout=2 * 60 * 60)


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

        for player in room.players:
            if not player.ready: return

        room.start()
        room.prepare_next_round()
        room.save()

        socketio.start_background_task(start_next_round, room.serialize())

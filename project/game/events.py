from project.auth.models import AnonymousUser
from project.game.models import Room, RoomDict, GameState, RoundDict
from project.extensions import socketio, cache

from flask_socketio import SocketIO, join_room, leave_room
from flask import request

import time


playing_users = {}


def start_next_round(room: RoomDict) -> None:
    socketio.sleep(15)

    socketio.emit("round_start", room["round"], to=room["id"])

    if room["round"]["game_mode"] == 0:
        room["state"] = GameState.ROUND_LETTERS.name
    
    elif room["round"]["game_mode"] == 1:
        room["state"] = GameState.ROUND_NUMBERS.name
    
    else:
        room["state"] = GameState.ROUND_CONUNDRUM.name
    
    cache.set(room["id"], room, timeout=2 * 60 * 60)


def start_timer(room: RoomDict) -> None:
    if room["round"]["game_mode"] == 1:
        socketio.emit("round_target", room["round_private"]["TARGET"][0], to=room["id"])
        socketio.sleep(2)

    else:
        socketio.sleep(1)

    socketio.emit("round_countdown", to=room["id"])

    # 30 (+ short grace) second countdown -> answers    
    room["state"] = GameState.ROUND_COUNTDOWN.name
    cache.set(room["id"], room, timeout=2 * 60 * 60)

    socketio.sleep(32)
    socketio.emit("round_answer", to=room["id"])

    room["state"] = GameState.ROUND_ANSWER.name
    cache.set(room["id"], room, timeout=2 * 60 * 60)

    # 5 second period to fill in answer
    socketio.sleep(5)
    socketio.emit("round_end", to=room["id"])

    room["state"] = GameState.ROUND_REVEAL.name
    cache.set(room["id"], room, timeout=2 * 60 * 60)

    socketio.sleep(1)

    Room.evaluate_answers(room)
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

        if room.state != GameState.WAITING: return

        room.start()
        room.prepare_next_round()
        room.save()

        socketio.start_background_task(start_next_round, room.serialize())


    @socketio.on("pick")
    def handle_pick(data: dict):
        user: AnonymousUser | None = AnonymousUser.get(data["token"])
        if not user: return

        room = Room.get(user.room_id)
        if not room: return
        if room.round["starting_player"] != user.player_id: return

        room.pick(data["type"])
        assert room.round["game_data"] != None, "lmfao"

        # Start the 30 second COUNTDOWN timer condition for each minigame
        if room.state == GameState.ROUND_LETTERS and len(room.round["game_data"]["letters"]) == 9:
            socketio.start_background_task(start_timer, room.serialize())

        if room.state == GameState.ROUND_NUMBERS and len(room.round["game_data"]["small"]) + len(room.round["game_data"]["large"]) == 6:
            socketio.start_background_task(start_timer, room.serialize())

        room.save()

        socketio.emit("round_entity", room.round["game_data"], to=room.id)


    @socketio.on("answer")
    def handle_answer(data: dict):
        user: AnonymousUser | None = AnonymousUser.get(data["token"])
        if not user: return

        room = Room.get(user.room_id)
        if not room: return
        if room.state != GameState.ROUND_ANSWER: return

        user.answer = data["answer"]
        user.save()
        
from project.auth.models import AnonymousUser
from project.game.models import Room, GameState

from flask_login import current_user, login_required
from flask import Blueprint, render_template, redirect, request, flash, make_response


game_blueprint = Blueprint("game", __name__)


@game_blueprint.get("/")
def index():
    if current_user.is_anonymous:
        return redirect("/auth")
    
    return redirect("/l")


@game_blueprint.get("/test")
def test():
    if current_user.is_anonymous:
        return redirect("/auth")

    current_user.player_id = -1

    room = Room(1, current_user)
    room.state = GameState.ROUND_NUMBERS

    return render_template("game/game.html", room=room)


@game_blueprint.route("/l", methods=["GET", "POST"])
@login_required
def lobby():
    user: AnonymousUser = current_user # type: ignore

    # Join room from link if you aren't already in a room
    room_id = request.args.get("id", "")
    room = Room.get(room_id)

    if room and (user.room_id == room_id or user.room_id == None):
        added = room.add_player(user)
        room.save()
        user.save()

        if added:
            return redirect("/g/" + room.id)

    # Regular get request, if user is in a existing room, redirect them, 
    # otherwise prompt them to lobby
    if request.method == "GET":
        if not user.room_id:
            return render_template("game/lobby.html")
        
        room = Room.get(user.room_id)
        if not room:

            user.room_id = None
            user.save()

            return render_template("game/lobby.html")

        return redirect("/g/" + room.id)
    
    if user.room_id:
        room = Room.get(user.room_id)
        if room:
            return redirect("/g/" + room.id)
        
        user.room_id = None

    room_id = request.form.get("id", "")

    # Create room
    if not room_id:
        team_size = 1 if request.form.get("mode") == "1v1" else 2
        room = Room(team_size, user)

        user.room_id = room.id
        user.save()

        return redirect("/g/" + room.id)

    room = Room.get(room_id)
    if not room:
        flash("Room not found.", category="error")
        return render_template("game/lobby.html")

    room.add_player(user)
    room.save()
    user.save()

    return redirect("/g/" + room.id)


@game_blueprint.get("/g/<string:id>")
@login_required
def game(id: str):
    user: AnonymousUser = current_user # type: ignore
    if not user.room_id == id: return redirect("/l")

    room = Room.get(id)
    if not room:
        user.room_id = None
        user.save()

        return redirect("/l")

    return render_template("game/game.html", room=room)

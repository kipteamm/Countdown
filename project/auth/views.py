from project.auth.models import AnonymousUser, User
from project.extensions import db

from flask import Blueprint, request, render_template, redirect, flash
from flask_login import login_user

import random


auth_blueprint = Blueprint("auth", __name__)


def _valid_string(value: str, min_length: int, max_length: int) -> bool:
    if not value: return False
    if len(value) < min_length: return False
    if len(value) > max_length: return False
    return True


@auth_blueprint.route("/auth", methods=["GET", "POST"])
def auth():
    if request.method == "GET":
        return render_template("auth/auth.html")
    
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()

    # Anyonmous user
    if not (username or password):
        id = random.randint(100000, 999999)
        a_user = AnonymousUser(f"Anonymous{id}")

        login_user(a_user)
        a_user.save()

        response = redirect("/l")
        response.set_cookie("ut", a_user.id)

        return response

    if not _valid_string(username, 1, 30):
        flash("Invalid username", "error")
        return render_template("auth/auth.html")

    if not _valid_string(password, 8, 128):
        flash("Invalid password", "error")
        return render_template("auth/auth.html")

    user: User | None = User.query.filter_by(lower_username=username.lower()).first()
    if user and not user.check_password(password):
        flash("Invalid password", "error")
        return render_template("auth/auth.html")

    elif not user:
        user = User(username, password)
        db.session.add(user)
        db.session.commit()
        
    login_user(user)
    user.save()

    response = redirect("/l")
    response.set_cookie("ut", user.id)

    return response

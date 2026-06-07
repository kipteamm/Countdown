from project.auth.models import AnonymousUser
from project.extensions import cache

from flask import Blueprint, request, render_template, redirect
from flask_login import login_user

import random


auth_blueprint = Blueprint("auth", __name__)


@auth_blueprint.route("/auth", methods=["GET", "POST"])
def auth():
    if request.method == "GET":
        return render_template("auth/auth.html")
    
    email = request.form.get("email", "").strip()

    # Anyonmous user
    if not email:
        id = random.randint(100000, 999999)
        user = AnonymousUser(f"Anonymous{id}")

        login_user(user)
        cache.set(user.id, user.serialize(), timeout=2 * 60 * 60)

        response = redirect("/l")
        response.set_cookie("ut", user.id)

        return response
    
    # Actual user (do later)
    # cache.set(user.id, user.serialize(), timeout=24 * 60 * 60)

    return redirect("/l")
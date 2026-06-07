from project.auth.models import AnonymousUser, User
from project.extensions import db, socketio, cache
from project.game.views import game_blueprint
from project.auth.views import auth_blueprint
from project.config import SECRET_KEY, DEBUG
from project.assets import assets


from flask_migrate import Migrate
from flask_login import LoginManager
from flask import Flask, request, redirect


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", static_url_path="/static")

    app.config["DEBUG"] = DEBUG
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///./db.sqlite3"

    app.register_blueprint(game_blueprint)
    app.register_blueprint(auth_blueprint)

    login_manager = LoginManager(app)
    migrate = Migrate()

    socketio.init_app(app)
    migrate.init_app(app, db)
    assets.init_app(app)
    cache.init_app(app)
    db.init_app(app)

    # register_events(socketio)

    @login_manager.user_loader
    def load_user(user_id: str):
        user = cache.get(user_id)
        if not user: return None
        
        return AnonymousUser.from_cache(user)
    

    @login_manager.unauthorized_handler
    def unauthorized():
        return redirect(f"/auth")
        
    return app

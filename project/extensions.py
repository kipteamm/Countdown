from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_caching import Cache
from flask_assets import Environment


socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")
assets = Environment()
cache = Cache(config={"CACHE_TYPE" : "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})
db = SQLAlchemy()

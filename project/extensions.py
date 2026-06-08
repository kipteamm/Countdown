from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_caching import Cache
from flask_assets import Environment

# import json


# class DebugCache:
#     def __init__(self):
#         self.cache = {}

#     def init_app(self, app) -> None:
#         return
    
#     def _print_cache(self) -> None:
#         for key, value in self.cache.items():
#             print(key, value)

#     def set(self, key, value, timeout):
#         self.cache[key] = json.dumps(value)
#         self._print_cache()

#     def get(self, cache):
#         data= self.cache.get(cache)
#         if not data: return

#         return json.loads(data)


socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")
assets = Environment()
cache = Cache(config={"CACHE_TYPE" : "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})
# cache = DebugCache()
db = SQLAlchemy()

from flask_assets import Bundle # type: ignore

from project.extensions import assets
from project.config import DEBUG


game_css = Bundle("css/base.css", "css/game/game.css", filters="cssmin", output="gen/packed_game.css" if DEBUG else "gen/packed.%(version)s.css")
game_js = Bundle("js/game/gameController.js", filters="rjsmin", output="gen/packed_game.js" if DEBUG else "gen/packed.%(version)s.js")
assets.register("game_css", game_css)
assets.register("game_js", game_js)

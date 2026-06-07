if [[ "$1" == "init" ]]; then
    mkdir -p project
    mkdir -p project/templates
    mkdir -p project/static
    mkdir -p project/static/css
    mkdir -p project/static/ts
    mkdir -p project/static/images
    mkdir -p project/static/icons


    cat > .gitignore <<EOF
# Ignore pycache
__pycache__/

# Ignore databases
db.sqlite3
db.sqlite3-journal

# Environment variables
.env

# Caching
.webassets-cache/
gen/
EOF

    cat > tsconfig.json <<EOF
{"compilerOptions":{"target":"es6","lib":["dom","es2021"],"module":"es6","outDir":"./project/static/js","rootDir":"./project/static/ts","strict":true,"esModuleInterop":true,"skipLibCheck":true,"forceConsistentCasingInFileNames":true,"declaration":false,"sourceMap":false},"include":["project/static/ts/**/*.ts"],"exclude":["node_modules"]}
EOF

    cat > .env <<EOF
SECRET_KEY=$(tr -dc "A-Za-z0-9\-" </dev/urandom | head -c 64; echo)
DEBUG=True
EOF

    cat > project/config.py <<EOF
from dotenv import load_dotenv

import os


load_dotenv()


SECRET_KEY = os.environ["SECRET_KEY"]
DEBUG = os.environ["DEBUG"]
EOF


    cat > project/assets.py <<EOF
from flask_assets import Bundle # type: ignore

from project.extensions import assets
from project.config import DEBUG
EOF

    echo "Check requirements.txt"
    cat > requirements.txt <<EOF
Flask-Login==0.6.3
Flask-Migrate==4.0.7
flask-caching==2.3.0
flask_socketio==5.5.1
flask_assets==2.1.0
gunicorn==23.0.0
eventlet==0.40.3
requests==2.32.5
cssmin==0.2.0
rjsmin==1.2.5
EOF

    PORT=$(shuf -i 1000-9999 -n 1)
    if [[ "$2" == "--socketio" ]]; then
        cat > app.py <<EOF
from project import create_app, socketio


app = create_app()


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=$PORT)
EOF

    cat > project/__init__.py <<EOF
from project.extensions import db, socketio, cache
from project.config import SECRET_KEY, DEBUG
from project.assets import assets


from flask_migrate import Migrate
from flask import Flask


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", static_url_path="/static")

    app.config["DEBUG"] = DEBUG
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///./db.sqlite3"

    migrate = Migrate()

    socketio.init_app(app)
    migrate.init_app(app, db)
    assets.init_app(app)
    cache.init_app(app)
    db.init_app(app)

    # register_events(socketio)
        
    return app
EOF

    cat > project/extensions.py <<EOF
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_caching import Cache
from flask_assets import Environment


socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")
assets = Environment()
cache = Cache(config={"CACHE_TYPE" : "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})
db = SQLAlchemy()
EOF

else
    cat > app.py <<EOF
from project import create_app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=$PORT)
EOF

cat > project/__init__.py <<EOF
from project.extensions import db, cache
from project.config import SECRET_KEY, DEBUG
from project.assets import assets


from flask_migrate import Migrate
from flask import Flask


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", static_url_path="/static")

    app.config["DEBUG"] = DEBUG
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///./db.sqlite3"

    migrate = Migrate()

    migrate.init_app(app, db)
    assets.init_app(app)
    cache.init_app(app)
    db.init_app(app)
        
    return app
EOF

        cat > project/extensions.py <<EOF
from flask_sqlalchemy import SQLAlchemy
from flask_caching import Cache
from flask_assets import Environment


assets = Environment()
cache = Cache(config={"CACHE_TYPE" : "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})
db = SQLAlchemy()
EOF
    fi

elif [[ "$1" == "add" ]]; then 
    mkdir project/"$2"
    mkdir project/templates/"$2"
    mkdir project/static/css/"$2"
    mkdir project/static/ts/"$2"
    
    touch project/"$2"/__init__.py

    cat > project/"$2"/views.py <<EOF
from flask import Blueprint


${2}_blueprint = Blueprint("$2", __name__)
EOF

    cat > project/"$2"/models.py <<EOF
from project.extensions import db
EOF
fi
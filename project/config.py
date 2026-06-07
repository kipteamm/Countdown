from dotenv import load_dotenv

import os


load_dotenv()


SECRET_KEY = os.environ["SECRET_KEY"]
DEBUG = os.environ["DEBUG"]

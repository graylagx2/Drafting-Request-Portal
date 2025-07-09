# config.py
import os
from dotenv import load_dotenv

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))
instance_dir = os.path.abspath(os.path.join(basedir, '..', 'instance'))  # <-- ABSOLUTE
sqlite_path = os.path.join(instance_dir, 'kern_energy_nexus.db')         # <-- ABSOLUTE

class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-dev-key")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{sqlite_path}")  # <-- ABSOLUTE
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER")

def load_config():
    return BaseConfig

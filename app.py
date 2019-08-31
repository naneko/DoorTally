import functools
import os
import threading
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, render_template, request, make_response, session, redirect, url_for
from flask_dotenv import DotEnv
from flask_login import LoginManager, current_user, login_user
from flask_migrate import Migrate
from flask_seasurf import SeaSurf
from flask_socketio import SocketIO, disconnect
from flask_sqlalchemy import SQLAlchemy

APP_ROOT = os.path.join(os.path.dirname(__file__), '..')   # refers to application_top
# dotenv_path = os.path.join(APP_ROOT, '.env')
# load_dotenv(dotenv_path)

app = Flask(__name__)
env = DotEnv(app)

login_manager = LoginManager()
login_manager.init_app(app)
db = SQLAlchemy(app)
migrate = Migrate(app, db)
socketio = SocketIO(app)
csrf = SeaSurf(app)

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)


# TODO: Add data persistence across restart
class Counter():
    def __init__(self, value):
        self.value = value


counter = Counter(0)


# TODO: Add admin flag
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    pin = db.Column(db.String(120), unique=True, nullable=False)
    admin = db.Column(db.Boolean)

    def is_authenticated(self):
        return True

    def is_active(self):
        return True

    def is_anonymous(self):
        return False

    def get_id(self):
        return self.id

    def __repr__(self):
        return '<User %r>' % self.name


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)


def authenticated_only(f):
    @functools.wraps(f)
    def wrapped(*args, **kwargs):
        if not current_user.is_authenticated:
            socketio.emit('authentication', 'auth_failed')
            disconnect()
        else:
            return f(*args, **kwargs)
    return wrapped


@app.errorhandler(404)
def page_not_found(e):
    return redirect(url_for('home'))


@app.route('/')
def home():
    return render_template('default.html')


@socketio.on('element')
def send_element(name):
    switch = {
        "login": api_element_login,
        "app": api_element_app
    }
    element = switch.get(name, lambda: "404 Error: Element not found")
    return element()


def api_element_login():
    return render_template('login.html')


def api_element_app():
    return render_template('app.html')


@socketio.on('action')
def do_action(name, data):
    switch = {
        "login": api_action_login,
        "counter": api_action_counter
    }
    action = switch.get(name, lambda: "400 Error: Action not found")
    return action(data)


# TODO: Actually validate login and session
def api_action_login(data):
    session.permanent = True
    user = User.query.filter_by(pin=data['pin']).first()
    if user is None:
        return "auth_error"
    elif data['pin'] == user.pin:
        login_user(user)
        return "ok"
    else:
        return "auth_error"


# TODO: Validate user session first
@authenticated_only
def api_action_counter(data):
    if data == "add":
        counter.value += 1
    if data == "subtract" and counter.value > 0:
        counter.value -= 1
    socketio.emit('counter', counter.value, broadcast=True)
    return "ok"


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0')

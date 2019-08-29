import os
import threading

from dotenv import load_dotenv
from flask import Flask, render_template, request, make_response
from flask_seasurf import SeaSurf
from flask_socketio import SocketIO

APP_ROOT = os.path.join(os.path.dirname(__file__), '..')   # refers to application_top
dotenv_path = os.path.join(APP_ROOT, '.env')
load_dotenv(dotenv_path)

app = Flask(__name__)
socketio = SocketIO(app)

app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY'),
)

csrf = SeaSurf(app)


# TODO: Add data persistence across restart
class Counter():
    def __init__(self, value):
        self.value = value


counter = Counter(0)


@app.route('/')
def home():
    return render_template('default.html')


@socketio.on_error()        # Handles the default namespace
def error_handler(e):
    print(e)


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
    return "ok"


# TODO: Validate user session first
def api_action_counter(data):
    if data == "add":
        counter.value += 1
    if data == "subtract":
        counter.value -= 1
    socketio.emit('counter', counter.value, broadcast=True)
    return "ok"


if __name__ == '__main__':
    socketio.run(app)

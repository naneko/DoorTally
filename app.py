import os
import threading

from dotenv import load_dotenv
from flask import Flask, render_template, request, make_response
from flask_seasurf import SeaSurf

APP_ROOT = os.path.join(os.path.dirname(__file__), '..')   # refers to application_top
dotenv_path = os.path.join(APP_ROOT, '.env')
load_dotenv(dotenv_path)

app = Flask(__name__)

app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY'),
)

csrf = SeaSurf(app)


class Counter(threading.Thread):
    def __init__(self, value):
        threading.Thread.__init__(self)
        self.e = threading.Event()
        self.value = value

    def set_value(self, value):
        self.value = value
        self.e.set()

    def get_value(self):
        self.e.clear()
        self.e.wait()
        return str(self.value)


counter = Counter(0)
counter.start()


def no_cache(r):
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    r.headers['Cache-Control'] = 'public, max-age=0'
    return r


@app.route('/')
def home():
    return render_template('default.html')


# TODO: Try to find a way to redirect when API pages are accessed directly (Though they wouldn't do anything anyways)
@app.route('/api/element/login')
def api_element_login():
    # TODO: This should check to make sure the user is in an active session and return an error if the user is not in an active session
    r = make_response(render_template('login.html'))
    return no_cache(r)


@app.route('/api/element/login/action/login', methods=['POST'])
def api_action_login():
    # TODO: Check user pin and create new session if correct (this session should be sent back to the client for storage)
    # TODO: If pin is empty but user has valid session, grant login
    data = request.data
    return "ok"


@app.route('/api/element/app')
def api_element_app():
    r = make_response(render_template('app.html'))
    return no_cache(r)


@app.route('/api/element/app/listener/count')
def api_listener_count():
    return counter.get_value()


@app.route('/api/element/app/action/count')
def api_action_count():
    counter.set_value(1000)
    return "ok"


if __name__ == '__main__':
    app.run(app)

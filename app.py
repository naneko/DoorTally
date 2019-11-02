import functools
import os
import random
import threading
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, render_template, request, make_response, session, redirect, url_for
from flask_dotenv import DotEnv
from flask_login import LoginManager, current_user, login_user, logout_user
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


# TODO: Add admin flag
class Instance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    pin = db.Column(db.String(120), unique=True, nullable=False)
    admin = db.Column(db.Boolean)

    value = db.Column(db.Integer)
    max_value = db.Column(db.Integer)
    buffer = db.Column(db.Integer)

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
    return Instance.query.get(user_id)


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
    if Instance.query.filter_by(admin=True).first() is None:
        instance = Instance(name='admin', pin='1234', admin=True, value=0, max_value=0, buffer=0)
        db.session.add(instance)
        db.session.commit()
    return render_template('default.html')


@app.route('/init')
def init_db():
    instance = Instance.query.filter_by(admin=True).first()
    app.logger.info('Init: Checking for admin user')
    if instance is None:
        app.logger.info('Init: No admin user found. Creating...')
        instance = Instance(name='admin', pin='1234', admin=True, value=0, max_value=0, buffer=0)
        db.session.add(instance)
        db.session.commit()
        app.logger.info('Init: Admin user created')
    else:
        app.logger.info('Init: Admin user already exists')
    return redirect(url_for('home'))


@socketio.on('element')
def send_element(name):
    switch = {
        "login": api_element_login,
        "app": api_element_app,
        "admin": api_element_admin
    }
    element = switch.get(name, lambda x: "404 Error: Element not found")
    return element()


def api_element_login():
    return render_template('login.html')


def api_element_app():
    return render_template('app.html')


def api_element_admin():
    # TODO: Check that instance is actually an admin
    instances = Instance.query.all()
    return render_template('admin.html', instances=instances)


@socketio.on('action')
def do_action(name, data):
    switch = {
        "login": api_action_login,
        "counter": api_action_counter,
        "admin": api_action_admin,
        "logout": api_action_logout,
        "adduser": api_action_adduser
    }
    action = switch.get(name, lambda x: "400 Error: Action not found")
    return action(data)


# TODO: Actually validate login and session
def api_action_login(data):
    session.permanent = True
    user = Instance.query.filter_by(pin=data['pin']).first()
    if user is None:
        return "auth_error"
    elif data['pin'] == user.pin:
        login_user(user)
        if user.admin:
            return "ok_admin"
        return "ok"
    else:
        return "auth_error"


# TODO: Validate user session first
@authenticated_only
def api_action_counter(data):
    counter = current_user
    if data == "add":
        counter.value += 1
    if data == "subtract" and counter.value > 0:
        counter.value -= 1
    db.session.add(counter)
    db.session.commit()
    socketio.emit('counter', counter.value, broadcast=True)

    if counter.max_value > counter.value >= counter.buffer:
        distance = counter.max_value - counter.value
        socketio.emit('notification', (1, '{} visitors away from max capacity'.format(distance)), broadcast=True)
    elif counter.value == counter.max_value:
        socketio.emit('notification', (2, 'At max capacity'), broadcast=True)
    elif counter.value > counter.max_value:
        distance = counter.value - counter.max_value
        socketio.emit('notification', (3,  '{} visitors over capacity'.format(distance)), broadcast=True)
    else:
        socketio.emit('notification', 0)

    return "ok"


@authenticated_only
def api_action_admin(data):
    if current_user.admin:
        instance = Instance.query.filter_by(id=data['instance']).first()
        x = data['field']
        if x == 'max_value':
            if data['value'] == '':
                instance.max_value = 0
            else:
                instance.max_value = data['value']
        elif x == 'name':
            if data['value'] != '' and Instance.query.filter_by(name=data['value']).first() is None:
                instance.name = data['value']
            else:
                return "value_error"
        elif x == 'buffer':
            if data['value'] == '':
                instance.buffer = 0
            else:
                instance.buffer = data['value']
        elif x == 'value':
            if data['value'] == '':
                instance.value = 0
            else:
                instance.value = data['value']
        elif x == 'pin':
            if data['value'].isdigit() and data['value'] != '' and Instance.query.filter_by(pin=data['value']).first() is None:
                instance.pin = int(data['value'])
            else:
                return "value_error"
        db.session.add(instance)
        db.session.commit()
        socketio.emit('reload', broadcast=True)
        return "ok"
    else:
        return "auth_error"


def api_action_logout(data):
    logout_user()
    return "ok"


def api_action_adduser(data):
    print('crate usr')
    def create_unique_name():
        name = 'New Instance ' + str(random.randint(0, 50))
        if Instance.query.filter_by(name=name).first() is not None:
            return create_unique_name()
        return name

    def create_unique_pin():
        pin = random.randint(1111, 9999)
        if Instance.query.filter_by(pin=pin).first() is not None:
            return create_unique_pin()
        return pin

    name = create_unique_name()
    pin = create_unique_pin()
    instance = Instance(name=name, pin=pin, admin=False, value=0, max_value=0, buffer=0)
    db.session.add(instance)
    db.session.commit()
    return "ok"


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0')

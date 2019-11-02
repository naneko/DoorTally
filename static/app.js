let page; // Container to load elements
let debug = true; // Sets debug mode (is set onload, not here)
let connected = true; // Server connection status (is set onload, not here)
let interaction; // Determines weather to use click or touchend interaction method with Jquery

const socket = io();

// TODO: Add comments

/*
    Quick rundown of terminology:
     - An element is a snippit of HTML loaded from the server
     - An operator is the code that makes an element functional. This is normally a callback after an element is loaded.
 */

/*
    Loads element from server and shows error on fail
*/
function loadElement(name, callback) {
    page.empty();
    // Load the page
    socket.emit('element', name, (data) => {
        page.html(data);
        let pagetitle = "DoorTally | " + name.charAt(0).toUpperCase() + name.slice(1);
        window.history.replaceState({"html":data,"pageTitle":pagetitle}, pagetitle, name);
        if($.isFunction(callback)) {
          callback()
        }
        else if(callback !== undefined) {
            alert("An error occurred: The app may no longer function without reloading the page");
            throw "Callback is not a function";
        }
        if(debug) console.log("Element Loaded: " + name);
    });
}

/*
    Executes an action on the server
 */
function action(name, data, callback) {
    // Check if callback is a function
    socket.emit('action', name, data, (data) => {
        if ($.isFunction(callback)) {
            callback(data)
        }
        else if (callback !== undefined) {
            alert("An error occurred while performing the action " + name);
            throw "Callback is not a function";
        }
    });
    if(debug) console.log("Action Executed: " + name + " | " + data);
}

/*
    Connection Failed handler
 */
// TODO: Periodically test/detect disconnect
function connectionFailed() {
    console.error("Connection failed!");
    alert("Sorry but it seems you have been disconnected")
    // TODO: disable screen and ping until connection success
}

/*
    Connection Restored handler
 */
// TODO: Periodically test/detect disconnect
function connectionRestored(jqXHR, textStatus, errorThrown) {
    console.info("Connection Restored");
    // TODO: disable screen and ping until connection success
}


function isMobile() {
  try{ document.createEvent("TouchEvent"); return true; }
  catch(e){ return false; }
}


// ----

/*
    Loads the login element
 */
function loadLogin() {
    if(debug) console.log("Loading login...");
    loadElement("login", loginOperator)
}

/*
    Login Operator
*/
function loginOperator() {
    let numpadVal = "";
    let buttonVal = "";
    $(".numpad-button").on(interaction,function() { // On-click for a numpad button
        buttonVal = $(this).attr('data-value'); // Get the button value
        $(this).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); }); // Animate the button
        if(buttonVal === "enter") { // If the button is "enter"
            if(debug) console.log("Logging in...");
            action("login", { pin: numpadVal}, function(response) { // Execute login action
                // Login callback
                switch(response){
                    case "ok":
                        if(debug) console.info("Login ok");
                        loadApp();
                        break;
                    case "ok_admin":
                        if(debug) console.info("Login admin ok");
                        loadAdmin();
                        break;
                    case "auth_error":
                        if(debug) console.warn("Login auth error");
                        alert("Incorrect pin");
                        numpadVal = "";
                        $(".numpad-text").val(numpadVal);
                        break;
                    default:
                        if(debug) console.error("Login error");
                        alert("An error occurred")
                }
            });
        }
        else if(buttonVal === "backspace") { // If the button is "backspace"
            numpadVal = numpadVal.slice(0, -1); // Delete last character in textbox
        }
        else {
            numpadVal = numpadVal + $(this).attr('data-value'); // Type the data value
        }
        $(".numpad-text").val(numpadVal); // Update the textbox
    });
}

/*
    Loads the app element
 */
function loadApp() {
    if(debug) console.log("Loading app...");
    loadElement("app", appOperator);
}

function appOperator() {
    // TODO: Add 1s timeout function to detect disconnect
    socket.on('reload', () => {
        console.log("Refresh triggered by server");
        location.reload();
    });

    socket.on('counter', (data) => {
        $(".counter").text(data).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
    });

    socket.on('notification', (level, message) => {
        if(debug) console.log("Notification received | " + level + " | " + message);
        let notificationBox = $('#notification');
        let notification = (cssClass, message) => {return '<div class="notification ' + cssClass + '">' + message + '</div>'};
        switch(level) {
            case 1:
                notificationBox.html(notification('info', message));
                break;
            case 2:
                notificationBox.html(notification('warn', message));
                break;
            case 3:
                notificationBox.html(notification('alert', message));
                break;
            default:
                notificationBox.empty();
                break;
        }
    });

    action("counter", "get");
    $(".up").on(interaction, function() {
        $(this).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
        action("counter", "add");
    });
    $(".down").on(interaction, function() {
        $(this).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
        action("counter", "subtract");
    });
}

/*
    Loads the admin element
 */
function loadAdmin() {
    if(debug) console.log("Loading admin...");
    loadElement("admin", adminOperator);
}

function adminOperator() {
    $(".instance-input").on("input",function() {
        let instance = $(this).attr("data-instance");
        let field = $(this).attr("name");
        let value = $(this).val();
        $(".admin-notify").removeClass("error").addClass("saving").text("Saving");
        action('admin', {instance: instance, field: field, value: value}, function(response) {
            if(response === "ok"){
                $(".admin-notify").removeClass("saving").text("Saved");
            }
            else {
                $(".admin-notify").removeClass("saving").addClass("error").text("Check Values");
            }
        });
    });
    $("#logout").on(interaction, function() {
        $(".admin-notify").addClass("saving").text("Logging out...");
        $(this).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
        action("logout");
        loadLogin();
    });
    $("#adduser").on(interaction, function() {
        $(".admin-notify").addClass("saving").text("Adding user...");
        $(this).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
        action("adduser");
        loadAdmin();
    });
}

//-----

/*
    On-load
 */
$(function() {
    // Set page to content div
    page = $("#content");

    socket.on('authentication', (message) => {
        switch (message) {
            case "auth_failed":
                alert("You are currently not authenticated. Please reload and log in.");
                location.reload();
                break;
            default:
                break;
        }
    });

    socket.on('connect', () => {
        console.log("Connected to server");
        if(connected === false){
            connectionRestored();
        }
        connected = true
    });

    socket.on('disconnect', () => {
        console.log("Disconnected from server");
        connected = false;
        connectionFailed();
    });

    if(isMobile()) {
        interaction = "touchend"
    }
    else {
        interaction = "click"
    }

    // Debug Hashes
    // If you are fancy and think you can use the debug features to l33t h4x0r the system, the server still validates your user session so things won't work
    switch(window.location.hash) {
        case "#debug":
            loadLogin();
            break;
        case "#debug-app":
            loadApp();
            break;
        case "#debug-admin":
            loadAdmin();
            break;
        default:
            debug = false;
            loadLogin();
    }
});
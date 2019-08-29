let page;
let session;
let debug = true;

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
function connectionFailed(jqXHR, textStatus, errorThrown) {
    console.error("Connection failed! " + textStatus + " " + errorThrown);
    alert("Sorry but it seems you have been disconnected")
    // TODO: disable screen and ping until connection success
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
    $(".numpad-button").on('click',function() { // On-click for a numpad button
        buttonVal = $(this).attr('data-value'); // Get the button value
        $(this).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); }); // Animate the button
        if(buttonVal === "enter") { // If the button is "enter"
            action("login", { pin: numpadVal, session: session }, function(response) { // Execute login action
                // Login callback
                if(response === "ok") {
                    loadApp()
                } else {
                    alert("Incorrect pin")
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
    socket.on('counter', (data) => {
        $(".counter").text(data).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
    });
    action("counter");
    $(".up").on("click", function() {
        $(this).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
        action("counter", "add");
    });
    $(".down").on("click", function() {
        $(this).stop().fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
        action("counter", "subtract");
    });
}

//-----

/*
    On-load
 */
$(function() {
    // Set page to content div
    page = $("#content");

    // Debug Hashes
    // If you are fancy and think you can use the debug features to l33t h4x0r the system, the server still validates your user session so things won't work
    switch(window.location.hash) {
        case "#debug":
            loadLogin();
            break;
        case "#debug-app":
            loadApp();
            break;
        default:
            debug = false;
            loadLogin();
    }
});
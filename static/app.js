let page;
let session;

/*
    Quick rundown of terminology:
     - An element is a snippit of HTML loaded from the server
     - An operator is the code that makes an element functional. This is normally a callback after an element is loaded.
 */

/*
    On-load
 */
$(function() {
    // Set page to content div
    page = $("#content");

    // Add CSRF token to AJAX header from the hidden input field on the page
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            let csrftoken = $("#_csrf_token").val();
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    });

    // Debug Hashes
    // If you are fancy and think you can use the debug features to l33t h4x0r the system, the server still validates your user session so things won't work
    switch(window.location.hash) {
        case "#debug-app":
            loadApp();
            break;
        default:
            loadLogin();
    }
});

/*
    Loads element from server and shows error on fail
*/
function loadElement(url, callback) {
    page.empty();
    // Try loading the page
    page.load(url, function( response, status, xhr ) {
      if ( status === "error" ) {
          alert("Sorry but there was an error: " + xhr.status + " " + xhr.statusText );
          throw "Failed to load element " + url + ": " + xhr.status + " " + xhr.statusText;
      }
      // Check if the callback is indeed a function, then run it
      else if($.isFunction(callback)) {
          callback()
      }
      else if(callback !== undefined) {
          throw "Callback is not a function";
      }
      console.log("Element Loaded: " + url);
    });
}

/*
    Executes an action on the server
 */
function action(url, data, callback) {
    // Check if callback is a function
    if($.isFunction(callback) && typeof callback !== undefined) {
        // Make AJAX call
        $.ajax({
            method: "POST",
            url: url,
            data: data,
            cache: false,
        })
            .done(function(response){ // Execute callback and pass response data as attribute
                console.log("Action Executed: " + url);
                callback(response)
            })
            .fail(function (jqXHR, textStatus) {
                console.error("Action Failed to Execute: " + url);
                connectionFailed(jqXHR, textStatus)
            })
    }
    else if(callback !== undefined) {
        throw "Callback is not a function";
    }
}

/*
    Creates a new listener that awaits a response from the server and executes a callback on success
 */
function listener(url, callback) {
    $.ajax({
        url: url,
        type: 'GET',
        cache: false,
    })
        .done(function(response){ // Execute callback and pass response data as attribute
            callback(response)
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
            console.error("Listener Failed to Connect: " + url);
            connectionFailed(jqXHR, textStatus, errorThrown)
        })
}

/*
    Connection Failed handler
 */
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
    console.log("Loading login...");
    loadElement("/api/element/login", loginOperator)
}

/*
    Login Operator
*/
function loginOperator() {
    let numpadVal = "";
    let buttonVal = "";
    $(".numpad-button").on('click',function() { // On-click for a numpad button
        buttonVal = $(this).attr('data-value'); // Get the button value
        $(this).fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); }); // Animate the button
        if(buttonVal === "enter") { // If the button is "enter"
            action("/api/element/login/action/login", { pin: numpadVal, session: session }, function(response) { // Execute login action
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
    console.log("Loading app...");
    loadElement("/api/element/app", appOperator);
}

function appOperator() {
    function counterListener(response) {
        $(".counter").text(response);
        listener("/api/element/app/listener/count", counterListener);
    }
    counterListener(0);
    $(".up").on("click", function() {
        $(this).fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
    });
    $(".down").on("click", function() {
        $(this).fadeTo(0, 0.3, function() { $(this).fadeTo(500, 1.0); });
    });
}
# Audience Counter Design

## Login and User Management

- Users will log in with pin number set in configuration
- Login system will work over ajax for speed
- Users will be logged out after inactivity

## Counting

- Main app UI will consist of two arrows pointing up and down
- Lock access button in upper right corner
- Audience capacity will be shown on bottom
- Background will turn red with notification when capacity is reached
- Admin can reset count or set to a specific value

## AJAX
- App will send request to server. Server will only respond when there is something to update. When app receives an update, it will make another request.
- App will asynchronously check with server to make sure connection hasn't been lost
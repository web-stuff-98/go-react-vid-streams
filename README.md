# go-react-vid-streams

## This is an unfinished generic "motion detection security camera streaming app" where you connect different devices to a password protected server and record video streams. It's supposed to be run on a local network.

### Currently video streaming, motion detection and video downloads work, other things haven't been implemented yet

### I am not sure if "streamers" should be individually password protected or if it should just be the server on its own which has password access

#### Todos:

- A live feed for all streams available on the homepage using WebRTC
- Add a timestamp to the video streams
- Make the UI look good
- Command line interface for starting up the server with a custom password and assigning the environment variables
- Move the client to Tauri so it can be run as a desktop app that looks cool
- When it's done add some short documentation on how to use it

# go-react-vid-streams

## This is an unfinished generic "motion detection security camera streaming app" where you connect different devices to a password protected server and record video streams

### Currently video streaming, motion detection and video downloads work, other things haven't been implemented yet

When you are logged into the server, you don't need a password to login/register streamers.

When it is done there will be a seperate client and server app. The server exe will have command line arguments for the server password. Clients will connect to the server and add their media streams, where all media streams will be visible on the homepage, with a download button for downloading the footage up to the current point where motion was detected.

#### Todos:

- A live feed for all streams available on the homepage using WebRTC
- Add a timestamp to the video streams
- Make the UI look good
- Command line interface for starting up the server with a custom password and assigning the environment variables
- Move the client to Tauri so it can be run as a desktop app that looks cool
- When it's done add some short documentation on how to use it

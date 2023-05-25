# go-react-vid-streams

## This is an unfinished generic "motion detection security camera streaming app" where you connect different devices to a password protected server and record video streams, and also watch them from the home page. These are the only features that I have implemented at the moment (watching streams through WebRTC, recording streams as chunks onto postgres when motion is detected, using cookies and JWTs to authenticate logins)

# Problems:

No timestamp in download video / video playback... I don't know how to fix this. Also I don't know how to add a timestamp to the video frames. I have tried but I will try again after I've done other stuff or gotten completely bored of the project.

#### Todos:

- Timestamp on video frames and get playback trackbar to work with timestamp somehow
- Motion sensitivity slider for individual streams
- Page for finding both active & inactive stream recordings
- Add sound to the streams
- Move the client to Tauri so it can be run as a neat 1 file .exe that looks cool with rounded borders, custom icons and stuff
- When it's done add a basic GUI for setting up the server and instructions on how to use the client app, in away that anybody could open up the built server exe file, read the instructions and easily get stuff set up

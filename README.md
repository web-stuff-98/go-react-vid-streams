# go-react-vid-streams

## This is an unfinished generic "motion detection security camera streaming app" where you connect different devices to a password protected server and record video streams, and also watch them from the home page. These are the only features that I have implemented at the moment (watching streams through WebRTC, recording streams as chunks onto postgres when motion is detected, using cookies and JWTs to authenticate logins)

# Problems:

No timestamp in download video / video playback because there's no EBML data embedded in the webm, so the trackbar cannot be used...

#### Todos:

- Replace the crappy motion detection with something that actually detects motion reliably rather than just watching for changes in the average pixel colour between frames - one way is to split up the images into smaller sections and run the same "algorithm" on each section
- Timestamp on video frames and get playback trackbar to work somehow, looks like the only way to do this without wasting loads of time is to use ffmpeg to convert the WebM to an MP4 before sending it back to the client for playback - or to use fix-webm-duration on the client
- Motion sensitivity slider for individual streams
- Page for finding both active & inactive stream recordings
- Add sound to the streams
- Move the client to Tauri so it can be run as a neat 1 file .exe that looks cool with rounded borders, custom icons and stuff
- When it's done add a basic GUI for setting up the server and instructions on how to use the client app, in away that anybody could open up the built server exe file, read the instructions and easily get stuff set up

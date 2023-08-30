# go-react-vid-streams

## This is a mostly finished "motion detection security camera streaming app" where you connect different devices to a password protected server and record video streams, and also watch them from the home page. These are the only features that I have implemented because I can't be asked to finish this project because I have no idea how to add trackbar data to video files properly

# Problems:

I am using fix-webm-duration to add the duration metadata to the video after downloading it because I have no idea how to add the correct EBML metadata to a WebM to get the trackbar to work myself

#### Todos (which I will never do):

- Replace the crappy average pixel difference motion detection with OpenCV or something like that
- Motion sensitivity slider for individual streams
- Add sound to the streams
- Add timestamp display to video somehow
- Add a basic Tauri GUI for the server with instructions on how to use the client app
- Remove redis, replace it with in-memory session handling since it's a small app and it reduces dependencies

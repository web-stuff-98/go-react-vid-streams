import axios from "axios";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

type StreamInfo = {
  stream: MediaStream;
  motion: boolean;
  lastFrame?: ImageData;
};

export const StreamingContext = createContext<{
  streams: Record<string, StreamInfo>;
  addStream: (name: string, deviceId: string) => Promise<void>;
  removeStream: (name: string) => void;
}>({
  streams: {},
  addStream: () => new Promise((r) => r()),
  removeStream: () => {},
});

export const StreamingProvider = ({ children }: { children: ReactNode }) => {
  const { server } = useAuth();

  const [streams, setStreams] = useState<Record<string, StreamInfo>>({});
  const [recorders, setRecorders] = useState<Record<string, MediaRecorder>>({});

  const addStream = async (name: string, deviceId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId },
    });
    setStreams((s) => ({
      ...s,
      [name]: { stream, motion: false },
    }));
  };

  const removeStream = (name: string) => {
    setStreams((s) => {
      const newStreams = s;
      delete newStreams[name];
      return newStreams;
    });
    setRecorders((r) => {
      const newRecorders = r;
      delete newRecorders[name];
      return newRecorders;
    });
  };

  const getImageData = (name: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    ctx!.drawImage(
      document.getElementById(`vid-${name}`) as HTMLVideoElement,
      0,
      0
    );
    const imageData = ctx!.getImageData(0, 0, 100, 60);
    return imageData;
  };

  // setup and run interval for motion detection
  useEffect(() => {
    const motionDetectionInterval = setInterval(async () => {
      for await (const name of Object.keys(streams)) {
        const currentFrameData = getImageData(name);

        // compare the last frame (if it's present) to the current frame
        if (streams[name].lastFrame) {
          const pixelDiffs: number[] = [];
          const lastFrameData = streams[name].lastFrame!;

          for (let i = 0; i < currentFrameData.data.length; i += 4) {
            const rPixelDiff = Math.abs(
              currentFrameData.data[i] - lastFrameData.data[i]
            );
            const gPixelDiff = Math.abs(
              currentFrameData.data[i + 1] - lastFrameData.data[i + 1]
            );
            const bPixelDiff = Math.abs(
              currentFrameData.data[i + 2] - lastFrameData.data[i + 2]
            );
            pixelDiffs.push((rPixelDiff + gPixelDiff + bPixelDiff) / 3);
          }

          const averagePixelDiff =
            pixelDiffs.reduce((acc, val) => acc + val, 0) /
            (currentFrameData.width * currentFrameData.height);
        }

        setStreams((s) => {
          const newStreams = s;
          newStreams[name].lastFrame = currentFrameData;
          return { ...newStreams };
        });
      }
    }, 300);
    return () => {
      clearInterval(motionDetectionInterval);
    };
    // putting recorders here in the useEffect dependency array was the
    // only way to get the interval to actually run without doing a hot
    // reload
  }, [recorders]);

  // add MediaRecorders
  useEffect(() => {
    Object.keys(streams).forEach((name) => {
      if (recorders[name] === undefined) {
        if (streams[name]) {
          const recorder = new MediaRecorder(streams[name].stream, {
            mimeType: "video/webm",
          });
          recorder.addEventListener("dataavailable", async (e) => {
            await axios({
              url: `${server}/api/video/chunk?name=${name}`,
              withCredentials: true,
              method: "POST",
              headers: {
                "Content-Type": "video/webm",
              },
              data: e.data,
            });
          });
          recorder.start(1000);
          setRecorders((r) => ({ ...r, [name]: recorder }));
        } else {
          console.log("Not present");
        }
      }
    });
  }, [streams]);

  return (
    <StreamingContext.Provider value={{ streams, addStream, removeStream }}>
      {children}
      {Object.keys(streams).map((k) => (
        <HiddenVideoWindow stream={streams[k].stream} name={k} />
      ))}
    </StreamingContext.Provider>
  );
};

// I had to use a hidden video window to grab pixel data because using
// the grabImage() function or whatever it's called on ImageBitmap was just
// returning empty values for every pixel no matter what.
// The video window is made to be really small to maintain performance.
function HiddenVideoWindow({
  stream,
  name,
}: {
  stream: MediaStream;
  name: string;
}) {
  const vidRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (stream && vidRef.current) vidRef.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      style={{ position: "fixed", filter: "opacity(0)" }}
      playsInline
      autoPlay
      width={100}
      height={60}
      id={`vid-${name}`}
      ref={vidRef}
    />
  );
}

export const useStreaming = () => useContext(StreamingContext);

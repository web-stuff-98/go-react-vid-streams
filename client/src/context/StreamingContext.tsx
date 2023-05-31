import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode, MutableRefObject } from "react";
import { useAuth } from "./AuthContext";
import { makeRequest } from "../services/makeRequest";
import useSocket from "./SocketContext";

/*
This handles streaming the users own streams to the server.
Handling other users streams via WebRTC is done by
StreamsContext.tsx
*/

type StreamInfo = {
  stream: MediaStream;
  motion: boolean;
  motionLastDetected?: number;
  lastFrame?: ImageData;
  deviceId: string;
};

export const StreamingContext = createContext<{
  streams: Record<string, StreamInfo>;
  streamsRef?: MutableRefObject<Record<string, StreamInfo>>;
  addStream: (name: string, deviceId: string) => Promise<void>;
  removeStream: (name: string) => void;
}>({
  streams: {},
  streamsRef: undefined,
  addStream: () => new Promise((r) => r()),
  removeStream: () => {},
});

export const StreamingProvider = ({ children }: { children: ReactNode }) => {
  const { server } = useAuth();
  const { sendIfPossible } = useSocket();

  const [streams, setStreams] = useState<Record<string, StreamInfo>>({});
  const [recorders, setRecorders] = useState<Record<string, MediaRecorder>>({});
  const streamsRef = useRef<Record<string, StreamInfo>>({});

  const rejoinWebRTC = () => {
    sendIfPossible({
      event: "WEBRTC_LEAVE",
      data: {},
    });
    setTimeout(() => {
      sendIfPossible({
        event: "WEBRTC_JOIN",
        data: {
          streams_info: Object.keys(streams).map((k) => ({
            name: k,
            media_stream_id: streams[k].stream.id,
          })),
        },
      });
    }, 2000);
  };

  const addStream = async (name: string, deviceId: string) => {
    if (streams[name]) throw new Error("There's a stream by that name already");
    if (Object.values(streams).find((s) => s.deviceId === deviceId))
      throw new Error("You're already streaming from the selected device");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId },
    });
    setStreams((s) => ({
      ...s,
      [name]: { stream, motion: false, deviceId },
    }));
    streamsRef.current = {
      ...streamsRef.current,
      [name]: { stream, motion: false, deviceId },
    };
  };

  const removeStream = (name: string) => {
    setStreams((s) => {
      const newStreams = s;
      delete newStreams[name];
      return { ...newStreams };
    });
    const s = streamsRef.current;
    delete s[name];
    streamsRef.current = s;
    setRecorders((r) => {
      const newRecorders = r;
      delete newRecorders[name];
      return { ...newRecorders };
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

  // setup and run interval for basic motion detection
  useEffect(() => {
    const motionDetectionInterval = setInterval(async () => {
      for await (const name of Object.keys(streams)) {
        let motionDetected = false;

        const currentFrameData = getImageData(name);

        // compare the brightness of the last frame (if its present) to the current frame,
        // but divide the frame data into smaller sections and compare each section individually
        // rather than comparing the overall brightness between both frames. That makes the
        // motion detection a bit more accurate. (divide into 10x10 sections)
        if (streams[name].lastFrame) {
          const lastFrameSections: Uint8ClampedArray[] = [];
          const currentFrameSections: Uint8ClampedArray[] = [];
          const lastFrameData = streams[name].lastFrame!;
          for (let i = 0; i < 10; ) {
            lastFrameSections.push(
              lastFrameData.data.slice(
                currentFrameData.data.length * 0.1 * i,
                currentFrameData.data.length * 0.1 * (i + 1)
              )
            );
            currentFrameSections.push(
              currentFrameData.data.slice(
                currentFrameData.data.length * 0.1 * i,
                currentFrameData.data.length * 0.1 * (i + 1)
              )
            );
            i++;
          }
          for (let i = 0; i < lastFrameSections.length; ) {
            const ls = lastFrameSections[i];
            const cs = currentFrameSections[i];
            const pixelDiffs: number[] = [];
            for (let i = 0; i < cs.length; i += 4) {
              const rPd = Math.abs(cs[i] - ls[i]);
              const gPd = Math.abs(cs[i + 1] - ls[i + 1]);
              const bPd = Math.abs(cs[i + 2] - ls[i + 2]);
              pixelDiffs.push((rPd + gPd + bPd) / 3);
            }
            if (!motionDetected) {
              if (
                pixelDiffs.reduce((acc, val) => acc + val, 0) /
                  (currentFrameData.width *
                    0.1 *
                    (currentFrameData.height * 0.1)) >
                1
              ) {
                motionDetected = true;
                i = lastFrameSections.length;
              }
            }
            i++;
          }
        }

        const motion =
          motionDetected ||
          (typeof streamsRef.current[name].motionLastDetected === "number" &&
            new Date().getTime() -
              (streamsRef.current[name].motionLastDetected as number) <
              5000);

        sendIfPossible({
          event: "WEBRTC_MOTION_UPDATE",
          data: {
            media_stream_id: streamsRef.current[name].stream.id,
            motion,
          },
        });

        setStreams((s) => {
          const newStreams = s;
          newStreams[name].lastFrame = currentFrameData;
          newStreams[name].motion = motion;
          return { ...newStreams };
        });
        const s = streamsRef.current;
        s[name].lastFrame = currentFrameData;
        s[name].motion = motion;
        if (motionDetected) s[name].motionLastDetected = new Date().getTime();
        streamsRef.current = s;
      }
    }, 300);
    rejoinWebRTC();
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
            if (streams[name].motion)
              await makeRequest({
                url: `${server}/api/video/chunk?name=${name}`,
                withCredentials: true,
                method: "POST",
                headers: { "Content-Type": "video/webm" },
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

  useEffect(() => {
    return () => {
      sendIfPossible({
        event: "WEBRTC_LEAVE",
        data: {},
      });
    };
  }, []);

  return (
    <StreamingContext.Provider
      value={{
        streams,
        streamsRef,
        addStream,
        removeStream,
      }}
    >
      {children}
      {Object.keys(streams).map((k) => (
        <HiddenVideoWindow key={k} stream={streams[k].stream} name={k} />
      ))}
    </StreamingContext.Provider>
  );
};

// I had to use a hidden video window to grab pixel data because using
// the grabImage() function or whatever it's called on ImageBitmap was just
// returning empty values for every pixel no matter what.
// The video window is made to be really small for performance because it's
// a lot of pixels for a 1920x1080 image.
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

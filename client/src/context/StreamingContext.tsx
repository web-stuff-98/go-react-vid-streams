import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode, MutableRefObject } from "react";
import { useAuth } from "./AuthContext";
import { makeRequest } from "../services/makeRequest";
import useSocket from "./SocketContext";
import { isChangeData } from "../socketComms/InterpretEvent";

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
  const { sendIfPossible, socket } = useSocket();

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
      video: {
        deviceId,
        frameRate: { ideal: 15, max: 20 },
        facingMode: "environment",
        width: { ideal: 720 },
      },
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
    canvas.width = 200;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    ctx!.drawImage(
      document.getElementById(`vid-${name}`) as HTMLVideoElement,
      0,
      0
    );
    const imageData = ctx!.getImageData(0, 0, 200, 120);
    return imageData;
  };

  // setup and run interval for basic motion detection
  useEffect(() => {
    const motionDetectionInterval = setInterval(async () => {
      for await (const name of Object.keys(streams)) {
        let motionDetected = false;

        // cf = current frame
        const cf = getImageData(name);

        // split the last frame and the current frame into 20x20
        // sections and compare the average pixel difference between
        // sections individually. If the pixel difference is above the
        // threshold in any of the sections then motion is detected.
        const numSecs = 20; // number of sections widthwise and lengthwise
        const secsDiv = 1 / numSecs;
        if (streams[name].lastFrame) {
          // lfSecs = last frame sections
          const lfSecs: Uint8ClampedArray[] = [];
          // cfSecs = last frame sections
          const cfSecs: Uint8ClampedArray[] = [];
          // lf = last frame
          const lf = streams[name].lastFrame!;
          for (let i = 0; i < numSecs; i++) {
            lfSecs.push(
              lf.data.slice(
                cf.data.length * secsDiv * i,
                cf.data.length * secsDiv * (i + 1)
              )
            );
            cfSecs.push(
              cf.data.slice(
                cf.data.length * secsDiv * i,
                cf.data.length * secsDiv * (i + 1)
              )
            );
          }
          // compare the sections
          for (let i = 0; i < lfSecs.length; i++) {
            // last frame section
            const ls = lfSecs[i];
            // current frame section
            const cs = cfSecs[i];
            const pDiffs: number[] = [];
            for (let i = 0; i < cs.length; i += 4) {
              const rPd = Math.abs(cs[i] - ls[i]);
              const gPd = Math.abs(cs[i + 1] - ls[i + 1]);
              const bPd = Math.abs(cs[i + 2] - ls[i + 2]);
              pDiffs.push((rPd + gPd + bPd) / 3);
            }
            if (!motionDetected) {
              if (
                pDiffs.reduce((acc, val) => acc + val, 0) /
                  (cf.width * secsDiv * (cf.height * secsDiv)) >
                1
              ) {
                motionDetected = true;
                // go to end of loop by setting iterator to end
                // since motion was detected other sections do
                // not need to be compared
                i = lfSecs.length;
              }
            }
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
          newStreams[name].lastFrame = cf;
          newStreams[name].motion = motion;
          return { ...newStreams };
        });
        const s = streamsRef.current;
        s[name].lastFrame = cf;
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

  const handleMessage = (e: MessageEvent) => {
    const msg = JSON.parse(e.data);
    if (!msg) return;
    if (isChangeData(msg))
      if (msg.data.entity === "STREAM")
        if (msg.data.method === "DELETE") rejoinWebRTC();
  };

  useEffect(() => {
    socket?.addEventListener("message", handleMessage);
    return () => socket?.removeEventListener("message", handleMessage);
  }, [socket]);

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
// returning empty values for every pixel no matter what. The video window
// is made to be really small because it's a lot of pixels for a 1920x1080
// image, and multiple streams from one device could be present.
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
      width={200}
      height={120}
      id={`vid-${name}`}
      ref={vidRef}
    />
  );
}

export const useStreaming = () => useContext(StreamingContext);

import styles from "./ViewStreams.module.scss";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useStreaming } from "../../../context/StreamingContext";
import { useStreams } from "../../../context/StreamsContext";
import { AiOutlineDownload } from "react-icons/ai";
import { useStreamers } from "../../../context/StreamersContext";
import { useSearchParams } from "react-router-dom";
import ResMsg from "../../shared/ResMsg";
import { makeRequest } from "../../../services/makeRequest";
import { IResMsg } from "../../../interfaces/GeneralInterfaces";
import useSocket from "../../../context/SocketContext";
import { isChangeData } from "../../../socketComms/InterpretEvent";
import ysDurationFix from "fix-webm-duration";

function toHoursAndMinutes(totalSeconds: number) {
  const totalMinutes = Math.floor(totalSeconds / 60);
  return {
    h: Math.floor(totalMinutes / 60),
    m: totalMinutes % 60,
    s: totalSeconds % 60,
  };
}

// Because WebM duration is fucked up when it comes from
// MediaRecorder, fix-webm-duration needs to be used....
// however fix-webm-duration does not work with larger than
// 256mb files because of browser compatibility or something
// like that... so if the video is larger than 256mb then the
// video has to be split up into seperate 256mb downloads that
// trigger automatically after the previous 256mb section has
// completed, fix-webm-duration runs on each downloaded section
// to repair the missing duration binary metadata... too dumb
// to add this binary metadata to it myself
function VideoDownloadButton({ name }: { name: string }) {
  const { server } = useAuth();

  // index is the 256mb section (0 for recordings smaller than 256mb)
  const downloadSection = async (index: number, sectionSeconds: number) => {
    const part = await makeRequest({
      url: `${server}/api/video/${name}?i=${index}`,
      responseType: "arraybuffer",
      withCredentials: true,
    });
    // fix the duration of the video section (the duration will be off
    // for long videos that are still recording because the size retreived
    // will be out of sync but whatever)
    const blob = await ysDurationFix(
      new Blob([part], { type: "video/webm" }),
      sectionSeconds * 1000
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const vidDur = toHoursAndMinutes(sectionSeconds);
    a.download = `${name}-section-${index}-${vidDur.s + "s"}${
      vidDur.m ? "-" + vidDur.m + "m" : ""
    }${vidDur.h ? "-" + vidDur.h + "h" : ""}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadVideo = async () => {
    const vidMeta: {
      size: number;
      seconds: number;
    } = await makeRequest({
      url: `${server}/api/video/meta/${name}`,
    });
    // figure out how many 256mb sections there are to the entire video and download them
    const sectionSize = 256 * 1024 * 1024;
    const divSections = vidMeta.size / sectionSize;
    const numSections = Math.floor(divSections);
    const sectionDuration = Math.ceil(vidMeta.seconds / divSections);
    let remainingSeconds = vidMeta.seconds;
    for (let i = 0; i <= numSections; i++) {
      await downloadSection(
        i,
        i === numSections ? remainingSeconds : sectionDuration
      );
      remainingSeconds -= sectionDuration;
    }
  };

  return (
    <button
      className={styles["download-button"]}
      aria-label="Download attachment"
      onClick={() => downloadVideo()}
    >
      <AiOutlineDownload />
    </button>
  );
}

function VideoStream({ stream }: { stream: MediaStream }) {
  const vidRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (vidRef.current) vidRef.current.srcObject = stream;
  }, [stream]);
  return (
    <video autoPlay playsInline ref={vidRef}>
      Your browser does not support the video tag
    </video>
  );
}

const LiveStreamWindow = ({
  name,
  stream,
  motion,
  uid,
}: {
  name: string;
  stream?: MediaStream;
  motion?: boolean;
  uid: string;
}) => {
  const { getStreamerName } = useStreamers();

  return (
    <li>
      {stream && <VideoStream stream={stream} />}
      <div className={styles["name"]}>
        {name}
        {motion && <> - Motion detected</>}
      </div>
      <VideoDownloadButton name={name} />
      {
        <span className={styles["live-indicator"]}>
          Active stream from {getStreamerName(uid)}
        </span>
      }
    </li>
  );
};

const OldStreamVideo = ({ name, uid }: { name: string; uid: string }) => {
  const { server } = useAuth();
  const { getStreamerName } = useStreamers();

  return (
    <li>
      <video width="320" height="240" controls>
        <source
          src={`${server}/api/video/playback/${name}`}
          type="video/webm"
        />
        Your browser does not support the video tag
      </video>
      <div className={styles["name"]}>{name}</div>
      <VideoDownloadButton name={name} />
      <span className={styles["inactive-indicator"]}>
        Inactive stream from {getStreamerName(uid)}
      </span>
    </li>
  );
};

function LiveStreams() {
  const { streams } = useStreaming();
  const { peers } = useStreams();
  const { uid } = useAuth();

  return (
    <ul className={styles["streams-list"]}>
      {peers &&
        Array.isArray(peers) &&
        peers.map((p) =>
          p.streams?.map((s) => (
            <LiveStreamWindow
              motion={s.motion}
              key={s.name}
              name={s.name}
              stream={s.stream}
              uid={p.streamerId}
            />
          ))
        )}
      {Object.keys(streams).map((name) => (
        <LiveStreamWindow
          uid={uid}
          motion={streams[name].motion}
          key={name}
          name={name}
          stream={streams[name].stream}
        />
      ))}
    </ul>
  );
}

function OldStreams() {
  const { server } = useAuth();
  const { socket } = useSocket();

  const [resMsg, setResMsg] = useState<IResMsg>({});

  const [streams, setStreams] = useState<
    { name: string; streamer_id: string }[]
  >([]);

  const getOldStreams = async () => {
    try {
      setResMsg({ pen: true });
      const streams = await makeRequest({
        url: `${server}/api/streams/old`,
      });
      setStreams(streams);
      setResMsg({ pen: false });
    } catch (e) {
      setResMsg({ err: true, msg: `${e}` });
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    getOldStreams();
    return () => {
      abortController.abort();
    };
  }, []);

  const handleMessage = (e: MessageEvent) => {
    const msg = JSON.parse(e.data);
    if (!msg) return;
    if (isChangeData(msg)) {
      if (msg.data.entity === "STREAM") {
        // @ts-ignore
        const name = msg.data.data["name"] as string;
        setStreams((s) => [...s.filter((s) => s.name !== name)]);
      }
    }
  };

  useEffect(() => {
    socket?.addEventListener("message", handleMessage);
    return () => {
      socket?.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  return (
    <>
      <ul className={styles["streams-list"]}>
        {streams &&
          Array.isArray(streams) &&
          streams.map((s) => (
            <OldStreamVideo name={s.name} uid={s.streamer_id} />
          ))}
      </ul>
      <ResMsg msg={resMsg} />
    </>
  );
}

export default function ViewStreams() {
  const [searchParams] = useSearchParams();
  return (
    <div className={styles["container"]}>
      {searchParams.has("live") ? (
        <LiveStreams />
      ) : searchParams.has("old") ? (
        <OldStreams />
      ) : (
        "No url param present"
      )}
    </div>
  );
}

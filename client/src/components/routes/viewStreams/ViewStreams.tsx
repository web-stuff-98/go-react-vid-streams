import styles from "./ViewStreams.module.scss";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useStreaming } from "../../../context/StreamingContext";
import { useStreams } from "../../../context/StreamsContext";
import { FaDownload } from "react-icons/fa";
import { AiFillEye, AiOutlineClose } from "react-icons/ai";
import { useStreamers } from "../../../context/StreamersContext";
import { useSearchParams } from "react-router-dom";
import ResMsg from "../../shared/ResMsg";
import { makeRequest } from "../../../services/makeRequest";
import { IResMsg } from "../../../interfaces/GeneralInterfaces";
import useSocket from "../../../context/SocketContext";
import { isChangeData } from "../../../socketComms/InterpretEvent";

function WatchStreamWithTrackbarModal({
  name,
  closeButtonClicked,
}: {
  name: string;
  closeButtonClicked: Function;
}) {
  const { server } = useAuth();

  return (
    <div className="modal-container">
      <div className={styles["watch-vid-modal-container"]}>
        <video width="320" height="240" controls>
          <source
            src={`${server}/api/video/playback/${name}`}
            type="video/mp4"
          />
          Your browser does not support the video tag
        </video>
        <div
          onClick={() => closeButtonClicked()}
          className="modal-close-button"
        >
          <AiOutlineClose />
        </div>
      </div>
    </div>
  );
}

function VideoDownloadButton({ name }: { name: string }) {
  const { server } = useAuth();

  const hiddenDownloadLink = useRef<HTMLAnchorElement>(null);
  return (
    <a
      aria-label="Download attachment"
      className={styles["download"]}
      download
      href={`${server}/api/video/${name}`}
      ref={hiddenDownloadLink}
    >
      <FaDownload />
      Download motion recording
    </a>
  );
}

function WatchVideoButton({ onClick }: { onClick: Function }) {
  return (
    <b onClick={() => onClick()}>
      <AiFillEye />
      Watch motion recording
    </b>
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
  watchClicked,
}: {
  name: string;
  stream?: MediaStream;
  motion?: boolean;
  uid: string;
  watchClicked: (name: string) => void;
}) => {
  const { getStreamerName } = useStreamers();

  return (
    <li>
      {
        <span className={styles["live-indicator"]}>
          Active stream from {getStreamerName(uid)}
        </span>
      }
      {stream && <VideoStream stream={stream} />}
      <div>
        {name}
        {motion && <> - Motion detected</>}
        <VideoDownloadButton name={name} />
        <WatchVideoButton onClick={() => watchClicked(name)} />
      </div>
    </li>
  );
};

const OldStreamVideo = ({
  name,
  uid,
  watchClicked,
}: {
  name: string;
  uid: string;
  watchClicked: (name: string) => void;
}) => {
  const { getStreamerName } = useStreamers();

  return (
    <li>
      {
        <span className={styles["inactive-indicator"]}>
          Inactive stream from {getStreamerName(uid)}
        </span>
      }
      <div>
        {name}
        <VideoDownloadButton name={name} />
        <WatchVideoButton onClick={() => watchClicked(name)} />
      </div>
    </li>
  );
};

function LiveStreams() {
  const { streams } = useStreaming();
  const { peers } = useStreams();
  const { uid } = useAuth();

  const [watchVideoStreamName, setWatchVideoStreamName] = useState("");

  const watchClicked = (name: string) => {
    setWatchVideoStreamName(name);
  };

  return (
    <div className={styles.container}>
      {peers &&
        peers.length > 0 &&
        JSON.stringify(peers.map((p) => ({ ...p, peer: undefined })))}
      <ul className={styles["streams-list"]}>
        {peers &&
          Array.isArray(peers) &&
          peers.map((p) =>
            p.streams?.map((s) => (
              <LiveStreamWindow
                watchClicked={watchClicked}
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
            watchClicked={watchClicked}
            motion={streams[name].motion}
            key={name}
            name={name}
            stream={streams[name].stream}
          />
        ))}
      </ul>
      {watchVideoStreamName && (
        <WatchStreamWithTrackbarModal
          closeButtonClicked={() => setWatchVideoStreamName("")}
          name={watchVideoStreamName}
        />
      )}
      {watchVideoStreamName && <div className="modal-backdrop" />}
    </div>
  );
}

function OldStreams() {
  const { server } = useAuth();
  const { socket } = useSocket();

  const [resMsg, setResMsg] = useState<IResMsg>({});

  const [streams, setStreams] = useState<
    { name: string; streamer_id: string }[]
  >([]);
  const [watchVideoStreamName, setWatchVideoStreamName] = useState("");

  const watchClicked = (name: string) => {
    setWatchVideoStreamName(name);
  };

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
        if (name === watchVideoStreamName) setWatchVideoStreamName("");
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
    <div className={styles.container}>
      {streams.map((s) => (
        <OldStreamVideo
          name={s.name}
          uid={s.streamer_id}
          watchClicked={(name: string) => watchClicked(name)}
        />
      ))}
      {watchVideoStreamName && (
        <WatchStreamWithTrackbarModal
          closeButtonClicked={() => setWatchVideoStreamName("")}
          name={watchVideoStreamName}
        />
      )}
      {watchVideoStreamName && <div className="modal-backdrop" />}
      <ResMsg msg={resMsg} />
    </div>
  );
}

export default function ViewStreams() {
  const [searchParams] = useSearchParams();

  return (
    <>
      {searchParams.has("live") && <LiveStreams />}
      {searchParams.has("old") && <OldStreams />}
    </>
  );
}

import styles from "./Home.module.scss";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useStreaming } from "../../../context/StreamingContext";
import { useStreams } from "../../../context/StreamsContext";
import { FaDownload } from "react-icons/fa";
import { AiFillEye, AiOutlineClose } from "react-icons/ai";

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
      Download full video stream recording
    </a>
  );
}

function WatchVideoButton({ onClick }: { onClick: Function }) {
  return (
    <b onClick={() => onClick()}>
      <AiFillEye />
      Watch stream recording with track bar
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

const StreamWindow = ({
  name,
  stream,
  motion,
  watchClicked,
}: {
  name: string;
  stream?: MediaStream;
  motion?: boolean;
  watchClicked: (name: string) => void;
}) => (
  <li>
    {<span className={styles["live-indicator"]} >
      Active stream
      </span>}
    {stream && <VideoStream stream={stream} />}
    <div>
      {name}
      {motion && <> - Motion detected</>}
      <VideoDownloadButton name={name} />
      <WatchVideoButton onClick={() => watchClicked(name)} />
    </div>
  </li>
);

export default function Home() {
  const { streams } = useStreaming();
  const { peers } = useStreams();

  const [watchVideoStreamId, setWatchVideoStreamId] = useState("");

  const watchClicked = (name: string) => {
    setWatchVideoStreamId(name);
  };

  return (
    <div className={styles.container}>
      {peers &&
        Array.isArray(peers) &&
        peers.length > 0 &&
        JSON.stringify(
          peers.map((p) => {
            let outP = p;
            return { ...outP, peer: undefined };
          })
        )}
      <ul className={styles["streams-list"]}>
        {peers &&
          Array.isArray(peers) &&
          peers.map((p) =>
            p.streams?.map((s) => (
              <StreamWindow
                watchClicked={watchClicked}
                motion={s.motion}
                key={s.name}
                name={s.name}
                stream={s.stream}
              />
            ))
          )}
        {Object.keys(streams).map((name) => (
          <StreamWindow
            watchClicked={watchClicked}
            motion={streams[name].motion}
            key={name}
            name={name}
            stream={streams[name].stream}
          />
        ))}
      </ul>
      {watchVideoStreamId && (
        <WatchStreamWithTrackbarModal
          closeButtonClicked={() => setWatchVideoStreamId("")}
          name={watchVideoStreamId}
        />
      )}
      {watchVideoStreamId && <div className="modal-backdrop" />}
    </div>
  );
}

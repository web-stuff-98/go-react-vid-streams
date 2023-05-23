import styles from "./Home.module.scss";
import { useEffect, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { FaDownload } from "react-icons/fa";
import { useStreaming } from "../../../context/StreamingContext";
import { useStreams } from "../../../context/StreamsContext";

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
      Download stream video
    </a>
  );
}

function VideoStream({ stream }: { stream: MediaStream }) {
  const vidRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (vidRef.current) vidRef.current.srcObject = stream;
  }, [stream]);
  return <video autoPlay playsInline ref={vidRef} />;
}

const StreamWindow = ({
  name,
  stream,
}: {
  name: string;
  stream?: MediaStream;
}) => (
  <li>
    {stream && <VideoStream stream={stream} />}
    <div>
      {name}
      {/*streams[name].motion && <> - Motion detected</>*/}
      <VideoDownloadButton name={name} />
    </div>
  </li>
);

export default function Home() {
  const { streams } = useStreaming();
  const { peers } = useStreams();

  return (
    <div className={styles.container}>
      {typeof peers}
      {peers && Array.isArray(peers) &&
        peers.length > 0 &&
        JSON.stringify(
          peers.map((p) => {
            let outP = p;
            return { ...outP, peer: undefined };
          })
        )}
      <ul className={styles["streams-list"]}>
        {peers && Array.isArray(peers) &&
          peers.map((p) =>
            p.streams?.map((s) => (
              <StreamWindow key={s.name} name={s.name} stream={s.stream} />
            ))
          )}
        {Object.keys(streams).map((name) => (
          <StreamWindow key={name} name={name} stream={streams[name].stream} />
        ))}
      </ul>
    </div>
  );
}

/*
    <div className={styles.container}>
      {peers &&
        peers.length > 0 &&
        JSON.stringify(
          peers.map((p) => {
            let outP = p;
            return { ...outP, peer: undefined };
          })
        )}
      <ul className={styles["streams-list"]}>
        {peers &&
          peers.map((p) =>
            p.streams?.map((s) => (
              <StreamWindow key={s.name} name={s.name} stream={s.stream} />
            ))
          )}
        {Object.keys(streams).map((name) => (
          <StreamWindow key={name} name={name} stream={streams[name].stream} />
        ))}
      </ul>
    </div>
*/

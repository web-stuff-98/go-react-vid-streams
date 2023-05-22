import styles from "./Home.module.scss";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { FaDownload } from "react-icons/fa";
import { useStreaming } from "../../../context/StreamingContext";
import { IResMsg } from "../../../interfaces/GeneralInterfaces";
import { makeRequest } from "../../../services/makeRequest";
import ResMsg from "../../shared/ResMsg";
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
  const { server } = useAuth();
  const { peers } = useStreams();

  const [resMsg, setResMsg] = useState<IResMsg>({});

  return (
    <div className={styles.container}>
      <ul className={styles["streams-list"]}>
        {peers.length > 0 && JSON.stringify(peers[0].streams)}
        {/*render all the WebRTC streams*/}
        {peers.map((p) =>
          p.streams?.map((s) => (
            <StreamWindow key={s.name} name={s.name} stream={s.stream} />
          ))
        )}
        {/*render the users own streams for debugging*/}
        {Object.keys(streams).map((name) => (
          <StreamWindow key={name} name={name} stream={streams[name].stream} />
        ))}
      </ul>
      <ResMsg msg={resMsg} />
    </div>
  );
}

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

export default function Home() {
  const { streams } = useStreaming();
  const { server } = useAuth();
  const { peersData } = useStreams();

  const [resMsg, setResMsg] = useState<IResMsg>({});

  return (
    <div className={styles.container}>
      <ul className={styles["streams-list"]}>
        {/*render all the WebRTC streams*/}
        {peersData.map((p) =>
          p.streams?.map((s) => (
            <li key={s.mediaStreamId}>
              {s.stream && <VideoStream stream={s.stream} />}
              <div>
                {s.name}
                {/*streams[name].motion && <> - Motion detected</>*/}
                <VideoDownloadButton name={s.name} />
              </div>
            </li>
          ))
        )}
      </ul>
      <ResMsg msg={resMsg} />
    </div>
  );
}

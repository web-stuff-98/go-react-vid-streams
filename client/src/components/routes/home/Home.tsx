import styles from "./Home.module.scss";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { FaDownload } from "react-icons/fa";
import { useStreaming } from "../../../context/StreamingContext";
import { IResMsg } from "../../../interfaces/GeneralInterfaces";
import axios from "axios";
import ResMsg from "../../shared/ResMsg";
import { makeRequest } from "../../../services/makeRequest";

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

  const [resMsg, setResMsg] = useState<IResMsg>({});
  const [videoNames, setVideoNames] = useState<string[]>([]);

  const getStreams = async () => {
    try {
      setResMsg({ pen: true });
      const names = await makeRequest({
        method: "GET",
        url: `${server}/api/videos`,
      });
      setVideoNames(names || []);
      setResMsg({ pen: false });
    } catch (e) {
      setResMsg({ err: true, msg: `${e}` });
    }
  };

  useEffect(() => {
    getStreams();
  }, []);

  return (
    <div className={styles.container}>
      <ul className={styles["streams-list"]}>
        {videoNames.map((name) => (
          <li key={name}>
            {streams[name] && <VideoStream stream={streams[name].stream} />}
            <div>
              {name}
              {streams[name].motion && <> - Motion detected</>}
              <VideoDownloadButton name={name} />
            </div>
          </li>
        ))}
      </ul>
      <ResMsg msg={resMsg} />
    </div>
  );
}

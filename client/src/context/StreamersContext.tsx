import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import useSocket from "./SocketContext";
import { isChangeData } from "../socketComms/InterpretEvent";
import { useAuth } from "./AuthContext";
import { makeRequest } from "../services/makeRequest";

export const StreamersContext = createContext<{
  // key is uid, value is streamer name
  streamers: Record<string, string>;
  getStreamerName: (uid: string) => string;
}>({
  streamers: {},
  getStreamerName: () => "",
});

export const StreamersProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocket();
  const { server, uid } = useAuth();

  const [streamers, setStreamers] = useState<Record<string, string>>({});

  const getStreamerName = useCallback(
    (uid: string) => {
      return streamers[uid];
    },
    [streamers]
  );

  const handleMessage = (e: MessageEvent) => {
    const msg = JSON.parse(e.data);
    if (!msg) return;
    if (isChangeData(msg)) {
      if (msg.data.entity === "STREAMER") {
        if (msg.data.method === "DELETE") {
          setStreamers((s) => {
            const newStreamers = s;
            delete newStreamers[msg.data.data.id];
            return { ...newStreamers };
          });
        }
        if (msg.data.method === "INSERT") {
          setStreamers((s) => {
            const newStreamers = s;
            // @ts-ignore
            newStreamers[msg.data.data.id] = msg.data.data["name"];
            return { ...newStreamers };
          });
        }
      }
    }
  };

  const getStreamers = async () => {
    const streamers: { uid: string; name: string }[] = await makeRequest({
      method: "GET",
      url: `${server}/api/streamers`,
    });
    let newStreamers: Record<string, string> = {};
    streamers.forEach((s) => {
      newStreamers[s.uid] = s.name;
    });
    setStreamers(newStreamers);
  };

  useEffect(() => {
    socket?.addEventListener("message", handleMessage);
    return () => {
      socket?.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  useEffect(() => {
    const abortController = new AbortController();
    getStreamers();
    return () => abortController.abort();
  }, [server]);

  const getStreamer = async () => {
    const name = await makeRequest({
      method: "GET",
      url: `${server}/api/streamers/${uid}`,
    });
    setStreamers((s) => ({ ...s, [uid]: name }));
  };

  useEffect(() => {
    if (uid) {
      // if the uid changes then retreive the user name from the server
      // since the socket connection wont be available yet to receive any
      // change update containing the user information
      getStreamer();
    }
  }, [uid]);

  return (
    <StreamersContext.Provider value={{ streamers, getStreamerName }}>
      {children}
    </StreamersContext.Provider>
  );
};

export const useStreamers = () => useContext(StreamersContext);

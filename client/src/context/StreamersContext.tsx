import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import useSocket from "./SocketContext";
import { isChangeData } from "../socketComms/InterpretEvent";

export const StreamersContext = createContext<{
  // key is uid, value is streamer name
  streamers: Record<string, string>;
}>({
  streamers: {},
});

export const streamersProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocket();

  const [streamers, setStreamers] = useState<Record<string, string>>({});

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

  useEffect(() => {
    socket?.addEventListener("message", handleMessage);
    return () => {
      socket?.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  return (
    <StreamersContext.Provider value={{ streamers }}>
      {children}
    </StreamersContext.Provider>
  );
};

export const useStreamers = () => useContext(StreamersContext);

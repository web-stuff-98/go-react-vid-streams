import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

export const SocketContext = createContext<{
  socket?: WebSocket;
  connect?: () => Promise<void>;
  sendIfPossible: (m: string | object) => void;
}>({
  socket: undefined,
  connect: () => new Promise((r) => r),
  sendIfPossible: () => {},
});

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { serverNoProtocol, uid } = useAuth();

  const [socket, setSocket] = useState<WebSocket>();

  const sendIfPossible = (data: string | object) => {
    if (socket && socket.readyState === 1)
      socket.send(typeof data === "string" ? data : JSON.stringify(data));
    else console.warn("No socket connection - failed to send message");
  };

  const connect = () =>
    new Promise<void>((r) => {
      const ws = new WebSocket(
        `ws${
          process.env.NODE_ENV === "production" ? "s" : ""
        }://${serverNoProtocol}/api/ws`
      );
      setTimeout(
        () =>
          ws.send(
            JSON.stringify({
              event: "WEBRTC_JOIN",
              data: {
                streams_info: [],
              },
            })
          ),
        1000
      );
      setSocket(ws);
      r();
    });

  useEffect(() => {
    if ((serverNoProtocol && !uid) || uid) {
      connect();
    }
  }, [serverNoProtocol, uid]);

  return (
    <SocketContext.Provider value={{ socket, connect, sendIfPossible }}>
      {children}
    </SocketContext.Provider>
  );
};

const useSocket = () => useContext(SocketContext);

export default useSocket;

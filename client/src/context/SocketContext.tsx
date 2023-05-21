import { createContext, useContext, useState } from "react";
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
  const { serverNoProtocol } = useAuth();

  const [socket, setSocket] = useState<WebSocket>();

  const sendIfPossible = (data: string | object) => {
    if (socket && socket.readyState === 1)
      socket.send(typeof data === "string" ? data : JSON.stringify(data));
    else console.warn("No socket connection - failed to send message");
  };

  const connect = () =>
    new Promise<void>((r) => {
      const ws = new WebSocket(`ws://${serverNoProtocol}`);
      setSocket(ws);
      r();
    });

  return (
    <SocketContext.Provider value={{ socket, connect, sendIfPossible }}>
      {children}
    </SocketContext.Provider>
  );
};

const useSocket = () => useContext(SocketContext);

export default useSocket;

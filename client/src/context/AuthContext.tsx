import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { makeRequest } from "../services/makeRequest";

export const AuthContext = createContext<{
  uid: string;
  server: string;
  serverNoProtocol: string;
  streamerLogin: (name: string) => Promise<void>;
  streamerRegister: (name: string) => Promise<void>;
  serverLogin: (address: string, password: string) => Promise<void>;
}>({
  uid: "",
  server: "",
  serverNoProtocol: "",
  streamerLogin: () => new Promise<void>((r) => r),
  streamerRegister: () => new Promise<void>((r) => r),
  serverLogin: () => new Promise<void>((r) => r),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [uid, setUid] = useState("");
  const [server, setServer] = useState("");
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timer>();
  const serverNoProtocol = useMemo(
    () => server.replaceAll("https://", "").replaceAll("http://", ""),
    [server]
  );

  const streamerLogin = async (name: string) => {
    const data = await makeRequest({
      url: `${server}/api/auth/streamer/login`,
      data: { name },
      method: "POST",
    });
    setUid(data);
  };

  const streamerRegister = async (name: string) => {
    const data = await makeRequest({
      url: `${server}/api/auth/streamer/register`,
      data: { name },
      method: "POST",
    });
    setUid(data);
  };

  const serverLogin = async (address: string, password: string) => {
    await makeRequest({
      url: `${address}/api/auth/login`,
      data: { password },
      method: "POST",
    });
    setServer(address);
  };

  const refreshIntervalFunc = async () => {
    await makeRequest({
      url: `${server}/api/auth/refresh`,
      method: "POST",
    });
  };

  useEffect(() => {
    if (server) setRefreshInterval(setInterval(refreshIntervalFunc, 20000));
    else clearInterval(refreshInterval);
  }, [server]);

  return (
    <AuthContext.Provider
      value={{
        uid,
        server,
        serverNoProtocol,
        streamerLogin,
        streamerRegister,
        serverLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

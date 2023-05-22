import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { makeRequest } from "../services/makeRequest";

export const AuthContext = createContext<{
  uid: string;
  server: string;
  serverNoProtocol: string;
  streamerLogin: (name: string) => Promise<void>;
  streamerRegister: (name: string) => Promise<void>;
  initialLogin: (
    address: string,
    password: string,
    streamerName: string
  ) => Promise<void>;
}>({
  uid: "",
  server: "",
  serverNoProtocol: "",
  streamerLogin: () => new Promise<void>((r) => r),
  streamerRegister: () => new Promise<void>((r) => r),
  initialLogin: () => new Promise<void>((r) => r),
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

  const initialLogin = async (
    address: string,
    password: string,
    streamerName: string
  ) => {
    const id = await makeRequest({
      url: `${address}/api/auth/login`,
      data: { server_password: password, streamer_name: streamerName },
      method: "POST",
    });
    setServer(address);
    setUid(id);
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
        initialLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

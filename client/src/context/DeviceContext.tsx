import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const DeviceContext = createContext<{
  // key is device id, value is device label
  devices: Record<string, string>;
  getDeviceList: () => Promise<boolean>;
}>({
  devices: {},
  getDeviceList: () => new Promise<boolean>((r) => r(false)),
});

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const [devices, setDevices] = useState({});

  const getDeviceList = async (): Promise<boolean> => {
    // getUserMedia must be called first otherwise enumerateDevices just returns an array
    // with empty strings where deviceId and label should be
    await navigator.mediaDevices.getUserMedia({ video: true });
    const devicesInfo = await navigator.mediaDevices.enumerateDevices();
    const newDevices: Record<string, string> = {};
    devicesInfo.forEach((d) => {
      if (d.kind === "videoinput") newDevices[d.deviceId] = d.label;
    });
    setDevices(newDevices);
    return Object.keys(newDevices.length).length !== 0;
  };

  const watchForDeviceChanges = async () =>
    (navigator.mediaDevices.ondevicechange = () => getDeviceList());

  useEffect(() => {
    watchForDeviceChanges();
  }, []);

  return (
    <DeviceContext.Provider value={{ devices, getDeviceList }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevices = () => useContext(DeviceContext);

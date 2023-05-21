import styles from "./StreamerSetup.module.scss";
import formStyles from "../../../FormClasses.module.scss";
import { ChangeEvent, useEffect, useState } from "react";
import { useDevices } from "../../../context/DeviceContext";
import { IResMsg } from "../../../interfaces/GeneralInterfaces";
import { useStreaming } from "../../../context/StreamingContext";
import ResMsg from "../../shared/ResMsg";

export default function StreamerSetup() {
  const { getDeviceList, devices } = useDevices();
  const { addStream } = useStreaming();

  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [streamName, setStreamName] = useState("");
  const [resMsg, setResMsg] = useState<IResMsg>({});

  useEffect(() => {
    getDeviceList();
  }, []);

  const DeviceListItem = ({
    deviceId,
    deviceLabel,
  }: {
    deviceId: string;
    deviceLabel: string;
  }) => <li onClick={() => setSelectedDeviceId(deviceId)}>{deviceLabel}</li>;

  const handleStreamName = (e: ChangeEvent) =>
    setStreamName((e.target as HTMLInputElement).value);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      setResMsg({ pen: true });
      await addStream(streamName, selectedDeviceId);
      setResMsg({ pen: false, msg: "Streaming started" });
    } catch (e) {
      console.log(e);
      setResMsg({ err: true, msg: `${e}` });
    }
  };

  return (
    <div className={styles["container"]}>
      <form onSubmit={handleSubmit} className={formStyles["form"]}>
        <ul className={styles["device-list"]}>
          {Object.keys(devices).map((k) => (
            <DeviceListItem key={k} deviceId={k} deviceLabel={devices[k]} />
          ))}
        </ul>
        <label htmlFor="name">Stream name</label>
        <input onChange={handleStreamName} id="name" type="text" required />
        <button type="submit">Add stream</button>
        <ResMsg msg={resMsg} />
      </form>
    </div>
  );
}

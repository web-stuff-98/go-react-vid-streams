import styles from "./AddStream.module.scss";
import formStyles from "../../../FormClasses.module.scss";
import { ChangeEvent, useEffect, useState } from "react";
import { useDevices } from "../../../context/DeviceContext";
import { IResMsg } from "../../../interfaces/GeneralInterfaces";
import { useStreaming } from "../../../context/StreamingContext";
import ResMsg from "../../shared/ResMsg";

export default function AddStream() {
  const { getDeviceList, devices } = useDevices();
  const { addStream } = useStreaming();

  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [streamName, setStreamName] = useState("");
  const [resMsg, setResMsg] = useState<IResMsg>({});
  const [deviceListResMsg, setDeviceListResMsg] = useState<IResMsg>({
    pen: true,
  });

  useEffect(() => {
    getDeviceList()
      .then((foundDevices) =>
        setDeviceListResMsg({
          pen: false,
          err: !foundDevices,
          msg: foundDevices ? "" : "A video device could not be found",
        })
      )
      .catch((e) => setDeviceListResMsg({ msg: `${e}`, err: true }));
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
        <div className={formStyles["input-label"]}>
          <label htmlFor="name">Stream name</label>
          <input onChange={handleStreamName} id="name" type="text" required />
        </div>
        <ul className={styles["device-list"]}>
          <ResMsg msg={deviceListResMsg} />
          {Object.keys(devices).map((k) => (
            <DeviceListItem key={k} deviceId={k} deviceLabel={devices[k]} />
          ))}
        </ul>
        <button
          disabled={
            !streamName ||
            Object.keys(devices).length == 0 ||
            selectedDeviceId === ""
          }
          type="submit"
        >
          Add stream
        </button>
        <ResMsg msg={resMsg} />
      </form>
    </div>
  );
}

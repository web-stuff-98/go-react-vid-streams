import styles from "./LoginRegister.module.scss";
import formStyles from "../../../FormClasses.module.scss";
import { useNavigate } from "react-router";
import { ChangeEvent, useState } from "react";
import { IResMsg } from "../../../interfaces/GeneralInterfaces";
import { useAuth } from "../../../context/AuthContext";
import ResMsg from "../../shared/ResMsg";

export default function ServerLogin() {
  const { initialLogin } = useAuth();

  const navigate = useNavigate();

  const [resMsg, setResMsg] = useState<IResMsg>({});
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [streamerName, setStreamerName] = useState("");

  const handleAddress = (e: ChangeEvent) =>
    setAddress((e.target as HTMLInputElement).value);

  const handlePassword = (e: ChangeEvent) =>
    setPassword((e.target as HTMLInputElement).value);

  const handleStreamerName = (e: ChangeEvent) =>
    setStreamerName((e.target as HTMLInputElement).value);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      setResMsg({ pen: true });
      await initialLogin(address, password, streamerName);
      navigate("/streams?live");
      setResMsg({ pen: false });
    } catch (e) {
      setResMsg({ err: true, msg: `${e}` });
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={formStyles.form}>
        <div className={formStyles["input-label"]}>
          <label htmlFor="address">Server address</label>
          <input onChange={handleAddress} id="address" type="text" required />
        </div>
        <div className={formStyles["input-label"]}>
          <label htmlFor="password">Server password</label>
          <input
            onChange={handlePassword}
            id="password"
            type="password"
            required
          />
        </div>
        <div className={formStyles["input-label"]}>
          <label htmlFor="streamer-name">Streamer name</label>
          <input
            onChange={handleStreamerName}
            id="streamer-name"
            type="text"
            required
          />
        </div>
        <button type="submit">Connect</button>
        <ResMsg msg={resMsg} />
      </form>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import type { ChangeEvent } from "react";
import { IResMsg } from "../../../interfaces/GeneralInterfaces";
import styles from "./LoginRegister.module.scss";
import formStyles from "../../../FormClasses.module.scss";
import ResMsg from "../../shared/ResMsg";

export default function StreamerRegister() {
  const { streamerRegister } = useAuth();

  const [resMsg, setResMsg] = useState<IResMsg>({});
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const handleName = (e: ChangeEvent) =>
    setName((e.target as HTMLInputElement).value);

  const handlePassword = (e: ChangeEvent) =>
    setPassword((e.target as HTMLInputElement).value);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      setResMsg({ pen: true });
      await streamerRegister(name, password);
      setResMsg({ pen: false });
    } catch (e) {
      setResMsg({ err: true, msg: `${e}` });
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={formStyles.form}>
        <div className={formStyles["input-label"]}>
          <label htmlFor="name">Name</label>
          <input onChange={handleName} id="name" type="text" required />
        </div>
        <div className={formStyles["input-label"]}>
          <label htmlFor="password">Password</label>
          <input onChange={handlePassword} id="password" type="password" />
        </div>
        <button type="submit">Add streamer</button>
        <ResMsg msg={resMsg} />
      </form>
    </div>
  );
}

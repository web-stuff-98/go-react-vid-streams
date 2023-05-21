import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import type { ChangeEvent } from "react";
import { IResMsg } from "../../../interfaces/GeneralInterfaces";
import styles from "./LoginRegister.module.scss";
import formStyles from "../../../FormClasses.module.scss";
import ResMsg from "../../shared/ResMsg";

export default function StreamerLogin() {
  const { streamerLogin } = useAuth();

  const [resMsg, setResMsg] = useState<IResMsg>({});
  const [name, setName] = useState("");

  const handleName = (e: ChangeEvent) =>
    setName((e.target as HTMLInputElement).value);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      setResMsg({ pen: true });
      await streamerLogin(name);
      setResMsg({ pen: false });
    } catch (e) {
      console.log(e)
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
        <button type="submit">Login streamer</button>
        <ResMsg msg={resMsg} />
      </form>
    </div>
  );
}

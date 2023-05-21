import styles from "./ResMsg.module.scss";
import { IResMsg } from "../../interfaces/GeneralInterfaces";
import { FaSpinner } from "react-icons/fa";
import { BiError } from "react-icons/bi";

export default function ResMsg({ msg }: { msg: IResMsg }) {
  return msg.pen || msg.err || msg.msg ? (
    <div className={styles["res-msg"]}>
      {msg.pen && <FaSpinner className={styles.spin} />}
      {msg.err && <BiError />}
      {msg.msg}
    </div>
  ) : (
    <></>
  );
}

import { Outlet } from "react-router";
import { Link } from "react-router-dom";
import "./Root.css";
import { useAuth } from "../../context/AuthContext";

const Root = () => {
  const { server, uid } = useAuth();

  return (
    <>
      <nav>
        <ul>
          {server && (
            <li>
              <Link to="/">Home</Link>
            </li>
          )}
          <li>
            <Link to="/login">Connect to server</Link>
          </li>
          {server && (
            <li>
              <Link to="/streamer/login">Login to streamer</Link>
            </li>
          )}
          {server && (
            <li>
              <Link to="/streamer/register">Register a streamer</Link>
            </li>
          )}
          {uid && (
            <li>
              <Link to="/streamer/setup">Setup streamer</Link>
            </li>
          )}
        </ul>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
};

export default Root;

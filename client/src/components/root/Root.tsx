import "./Root.css";
import { Outlet } from "react-router";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEffect } from "react";
import { useStreamers } from "../../context/StreamersContext";

const Root = () => {
  const { server, uid } = useAuth();
  const { getStreamerName } = useStreamers();

  useEffect(() => {
    document.body.classList.add("dark-mode");
  }, []);

  return (
    <>
      <nav>
        <ul>
          {server && (
            <li>
              <Link to="/">Watch video streams</Link>
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
        {getStreamerName(uid)}
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
};

export default Root;

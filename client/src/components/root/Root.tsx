import "./Root.css";
import { Outlet } from "react-router";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";
import { useStreamers } from "../../context/StreamersContext";
import { AiOutlineMenu } from "react-icons/ai";

const Root = () => {
  const { server, uid } = useAuth();
  const { getStreamerName } = useStreamers();

  const [showNavMenu, setShowNavMenu] = useState(false);

  useEffect(() => {
    document.body.classList.add("dark-mode");
  }, []);

  return (
    <>
      <nav>
        <button onClick={() => setShowNavMenu(!showNavMenu)}>
          <AiOutlineMenu />
        </button>
        {showNavMenu && (
          <ul onClick={() => setShowNavMenu(false)}>
            <li>
              <Link to="/">Connect to server</Link>
            </li>
            {server && (
              <>
                <li>
                  <Link to="/streams?live">Watch live video streams</Link>
                </li>
                <li>
                  <Link to="/streams?old">Watch old video streams</Link>
                </li>
                <li>
                  <Link to="/streamer/login">Login to streamer</Link>
                </li>
                <li>
                  <Link to="/streamer/register">Register a streamer</Link>
                </li>
              </>
            )}
            {uid && (
              <li>
                <Link to="/streamer/add">Add stream</Link>
              </li>
            )}
          </ul>
        )}
        {getStreamerName(uid)}
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
};

export default Root;

import "./App.css";
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { StreamersProvider } from "./context/StreamersContext";
import { DeviceProvider } from "./context/DeviceContext";
import { StreamingProvider } from "./context/StreamingContext";
import { StreamsProvider } from "./context/StreamsContext";
import Root from "./components/root/Root";
import ViewStreams from "./components/routes/viewStreams/ViewStreams";
import ServerLogin from "./components/routes/loginRegister/ServerLogin";
import StreamerLogin from "./components/routes/loginRegister/StreamerLogin";
import StreamerRegister from "./components/routes/loginRegister/StreamerRegister";
import AddStream from "./components/routes/addStream/AddStream";

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<Root />}>
        <Route index element={<ServerLogin />} />
        <Route path="/streams" element={<ViewStreams />} />
        <Route path="/streams" element={<ViewStreams />} />
        <Route path="/streamer/login" element={<StreamerLogin />} />
        <Route path="/streamer/register" element={<StreamerRegister />} />
        <Route path="/streamer/add" element={<AddStream />} />
      </Route>
    )
  );

  return (
    <DeviceProvider>
      <AuthProvider>
        <SocketProvider>
          <StreamersProvider>
            <StreamingProvider>
              <StreamsProvider>
                <RouterProvider router={router} />
              </StreamsProvider>
            </StreamingProvider>
          </StreamersProvider>
        </SocketProvider>
      </AuthProvider>
    </DeviceProvider>
  );
}

export default App;

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import Peer from "simple-peer";
import { useStreaming } from "./StreamingContext";
import useSocket from "./SocketContext";
import {
  isWebRTCAllUsers,
  isWebRTCJoinedSignal,
  isWebRTCReturnSignalOut,
  isWebRTCUserLeft,
} from "../socketComms/InterpretEvent";

/*
This handle all streams via webRTC server/client socket events
*/

type Stream = {
  stream?: MediaStream;
  mediaStreamId: string;
  name: string;
};

type PeerData = {
  streams?: Stream[];
  streamerId: string;
  peer: Peer.Instance;
};

export const StreamsContext = createContext<{
  // key is the stream name
  peers: PeerData[];
}>({
  peers: [],
});

export const StreamsProvider = ({ children }: { children: ReactNode }) => {
  const { sendIfPossible, socket } = useSocket();
  const { streamsRef } = useStreaming();

  const [peers, setPeers] = useState<PeerData[]>([]);
  const peersRef = useRef<PeerData[]>([]);

  const handleStream = (stream: MediaStream, uid: string) => {
    console.log(
      `Stream received from peer WebRTC connection - stream ID was ${stream.id} - Uid was ${uid}`
    );
    setPeers((p) => {
      console.log(p);
      const i = p.findIndex((p) => p.streamerId === uid);
      if (i == -1) {
        console.warn(
          "Could not find matching streamerId for stream in handler"
        );
        return p;
      }
      const newPeers = p;
      const si = (newPeers[i].streams || []).findIndex(
        (s) => s.mediaStreamId === stream.id
      );
      if (si !== -1) newPeers[i].streams![si].stream = stream;
      else
        console.warn(
          "Matching mediaStreamId could not be found for stream to be assigned to"
        );
      return [...newPeers];
    });
  };

  const addPeer = (callerId: string) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      streams: Object.values(streamsRef?.current || {}).map((s) => s.stream),
      iceCompleteTimeout: 2000,
    });
    peer.on("signal", (signal) => {
      sendIfPossible({
        event: "WEBRTC_RETURNING_SIGNAL",
        data: {
          signal: JSON.stringify(signal),
          caller_id: callerId,
          streams_info: Object.keys(streamsRef?.current || {}).map((name) => ({
            media_stream_id: streamsRef?.current[name].stream.id,
            name,
          })),
        },
      });
    });
    peer.on("stream", (stream) => handleStream(stream, callerId));
    return peer;
  };

  const createPeer = (uid: string) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      streams: Object.values(streamsRef?.current || {}).map((s) => s.stream),
      iceCompleteTimeout: 2000,
    });
    peer.on("signal", (signal) => {
      sendIfPossible({
        event: "WEBRTC_SENDING_SIGNAL",
        data: {
          signal: JSON.stringify(signal),
          to_uid: uid,
          streams_info: Object.keys(streamsRef?.current || {}).map((name) => ({
            media_stream_id: (streamsRef?.current || {})[name].stream.id,
            name,
          })),
        },
      });
    });
    peer.on("stream", (stream) => handleStream(stream, uid));
    console.log("Peer created with uid:", uid);
    return peer;
  };

  const handleMessage = (e: MessageEvent) => {
    const msg = JSON.parse(e.data);
    if (!msg) return;
    if (isWebRTCAllUsers(msg)) {
      const peers: PeerData[] = [];
      if (msg.data.users) {
        msg.data.users.forEach((user) => {
          const peer = createPeer(user.uid);
          peersRef.current.push({
            peer,
            streamerId: user.uid,
            streams: user.streams_info.map((i) => ({
              name: i.name,
              mediaStreamId: i.media_stream_id,
            })),
          });
          peers.push({
            peer,
            streamerId: user.uid,
            streams: user.streams_info.map((i) => ({
              name: i.name,
              mediaStreamId: i.media_stream_id,
            })),
          });
        });
      }
      setPeers(peers);
    }
    if (isWebRTCReturnSignalOut(msg)) {
      const newStreams = msg.data.streams_info.map((i) => ({
        name: i.name,
        mediaStreamId: i.media_stream_id,
      }));
      setPeers((p) => {
        const newPeers = p;
        if (i !== -1) newPeers[i].streams = newStreams;
        return [...newPeers];
      });
      const i = peersRef.current.findIndex(
        (pd) => pd.streamerId === msg.data.uid
      );
      if (i !== -1) {
        peersRef.current[i] = {
          ...peersRef.current[i],
          streams: newStreams,
        };
      }
      setTimeout(() => {
        peersRef.current
          .find((p) => p.streamerId === msg.data.uid)
          ?.peer.signal(JSON.parse(msg.data.signal));
      });
    }
    if (isWebRTCJoinedSignal(msg)) {
      console.log("Joined streams info:" + msg.data.streams_info);
      const peer = addPeer(msg.data.caller_id);
      const newData = {
        peer,
        streamerId: msg.data.caller_id,
        streams: msg.data.streams_info.map((i) => ({
          name: i.name,
          mediaStreamId: i.media_stream_id,
        })),
      };
      setPeers((p) => [...p, newData]);
      peersRef.current.push(newData);
      setTimeout(() => {
        peer.signal(JSON.parse(msg.data.signal));
      });
    }
    if (isWebRTCUserLeft(msg)) {
      const i = peers.findIndex((p) => p.streamerId === msg.data.uid);
      if (i !== -1) {
        setPeers((p) => {
          const newPeers = p;
          p[i].peer.destroy();
          newPeers.splice(i, 1);
          return [...newPeers];
        });
        peersRef.current.splice(i, 1);
      }
    }
  };

  useEffect(() => {
    socket?.addEventListener("message", handleMessage);
    return () => {
      socket?.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  return (
    <StreamsContext.Provider value={{ peers }}>
      {children}
    </StreamsContext.Provider>
  );
};

export const useStreams = () => useContext(StreamsContext);

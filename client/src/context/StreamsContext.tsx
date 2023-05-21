import { createContext, useContext, useEffect, useState } from "react";
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
  peersData: PeerData[];
}>({
  peersData: [],
});

export const StreamsProvider = ({ children }: { children: ReactNode }) => {
  const { sendIfPossible, socket } = useSocket();
  const { streams } = useStreaming();

  const [peersData, setPeersData] = useState<PeerData[]>([]);

  const handleStream = (stream: MediaStream, uid: string) => {
    const i = peersData.findIndex((p) => p.streamerId === uid);
    if (i !== -1) {
      setPeersData((p) => {
        const newPeers = p;
        const si = (newPeers[i].streams || []).findIndex(
          (s) => s.mediaStreamId === stream.id
        );
        if (si !== -1) newPeers[i].streams![si].stream = stream;
        return { ...newPeers };
      });
    }
  };

  const addPeer = (callerId: string) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      streams: Object.values(streams).map((s) => s.stream),
      iceCompleteTimeout: 2000,
    });
    peer.on("signal", (signal) => {
      sendIfPossible({
        event: "WEBRTC_RETURNING_SIGNAL",
        data: {
          signal: JSON.stringify(signal),
          caller_id: callerId,
          streams_info: Object.keys(streams).map((name) => ({
            media_stream_id: streams[name].stream.id,
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
      streams: Object.values(streams).map((s) => s.stream),
      iceCompleteTimeout: 2000,
    });
    peer.on("signal", (signal) => {
      sendIfPossible({
        event: "WEBRTC_SENDING_SIGNAL",
        data: {
          signal: JSON.stringify(signal),
          to_uid: uid,
          streams_info: Object.keys(streams).map((name) => ({
            media_stream_id: streams[name].stream.id,
            name,
          })),
        },
      });
    });
    peer.on("stream", (stream) => handleStream(stream, uid));
    return peer;
  };

  const handleMessage = (e: MessageEvent) => {
    const msg = JSON.parse(e.data);
    if (!msg) return;
    if (isWebRTCAllUsers(msg)) {
      const peers: PeerData[] = [];
      if (msg.data.users) {
        msg.data.users.forEach((user) => {
          peers.push({
            peer: createPeer(user.uid),
            streamerId: user.uid,
          });
        });
      }
      setPeersData(peers);
    }
    if (isWebRTCReturnSignalOut(msg)) {
      const peer = peersData.find((p) => p.streamerId === msg.data.uid)?.peer;
      if (peer) {
        setTimeout(() => {
          peer.signal(msg.data.signal);
        });
      } else {
        console.warn("Peer not found");
      }
    }
    if (isWebRTCJoinedSignal(msg)) {
      const i = peersData.findIndex((p) => p.streamerId === msg.data.caller_id);
      if (i !== -1) {
        peersData[i].peer.destroy();
        setPeersData((p) => {
          const newPeers = p;
          newPeers.splice(i, 1);
          return [...newPeers];
        });
      }
      const peer = addPeer(msg.data.caller_id);
      setPeersData((p) => {
        const newPeers: PeerData[] = [
          ...p,
          {
            peer,
            streamerId: msg.data.caller_id,
            streams: msg.data.streams_info.map((i) => ({
              name: i.name,
              mediaStreamId: i.media_stream_id,
            })),
          },
        ];
        return newPeers;
      });
      setTimeout(() => {
        peer.signal(msg.data.signal);
      });
    }
    if (isWebRTCUserLeft(msg)) {
      const i = peersData.findIndex((p) => p.streamerId === msg.data.uid);
      if (i !== -1) {
        setPeersData((p) => {
          const newPeers = p;
          p[i].peer.destroy();
          newPeers.splice(i, 1);
          return newPeers;
        });
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
    <StreamsContext.Provider value={{ peersData }}>
      {children}
    </StreamsContext.Provider>
  );
};

export const useStreams = () => useContext(StreamsContext);

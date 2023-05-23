type ChangeData = {
  data: {
    entity: "STREAMER" | "STREAM";
    method: "UPDATE" | "INSERT" | "DELETE";
    data: object & { id: string };
  };
};

type WebRTCJoinedSignal = {
  data: {
    signal: string;
    caller_id: string;
    streams_info: {
      media_stream_id: string;
      name: string;
      motion: boolean;
    }[];
  };
};

type WebRTCUserLeft = {
  data: {
    uid: string;
  };
};

type WebRTCReturnSignalOut = {
  data: {
    uid: string;
    signal: string;
    streams_info: {
      media_stream_id: string;
      name: string;
      motion: boolean;
    }[];
  };
};

type WebRTCAllUsers = {
  data: {
    users: {
      uid: string;
      streams_info: {
        media_stream_id: string;
        name: string;
        motion: boolean;
      }[];
    }[];
  };
};

type WebRTCMotionUpdate = {
  data: {
    media_stream_id: string;
    motion: boolean;
    streamer_id: string;
  };
};

export function isChangeData(object: any): object is ChangeData {
  return object.event === "CHANGE";
}

export function isWebRTCJoinedSignal(
  object: any
): object is WebRTCJoinedSignal {
  return object.event === "WEBRTC_JOINED_SIGNAL";
}
export function isWebRTCUserLeft(object: any): object is WebRTCUserLeft {
  return object.event === "WEBRTC_USER_LEFT";
}
export function isWebRTCReturnSignalOut(
  object: any
): object is WebRTCReturnSignalOut {
  return object.event === "WEBRTC_RETURN_SIGNAL_OUT";
}
export function isWebRTCAllUsers(object: any): object is WebRTCAllUsers {
  return object.event === "WEBRTC_ALL_USERS";
}
export function isWebRTCMotionUpdate(
  object: any
): object is WebRTCMotionUpdate {
  return object.event === "WEBRTC_MOTION_UPDATE";
}

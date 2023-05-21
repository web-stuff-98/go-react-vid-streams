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
  };
};

type WebRTCUserJoined = {
  data: {
    uid: string;
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
  };
};

type WebRTCAllUsers = {
  data: {
    users: { uid: string }[];
  };
};

export function isChangeData(object: any): object is ChangeData {
  return object.event === "CHANGE";
}

export function webRTCJoinedSignal(object: any): object is WebRTCJoinedSignal {
  return object.event === "WEBRTC_JOINED_SIGNAL";
}
export function webRTCUserJoined(object: any): object is WebRTCUserJoined {
  return object.event === "WEBRTC_USER_JOINED";
}
export function webRTCUserLeft(object: any): object is WebRTCUserLeft {
  return object.event === "WEBRTC_USER_LEFT";
}
export function webRTCReturnSignalOut(
  object: any
): object is WebRTCReturnSignalOut {
  return object.event === "WEBRTC_RETURN_SIGNAL_OUT";
}
export function webRTCAllUsers(object: any): object is WebRTCAllUsers {
  return object.event === "WEBRTC_ALL_USERS";
}

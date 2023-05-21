type ChangeData = {
  data: {
    entity: "STREAMER" | "STREAM";
    method: "UPDATE" | "INSERT" | "DELETE";
    data: object & { id: string };
  };
};

export function isChangeData(object: any): object is ChangeData {
  return object.event === "CHANGE";
}

import axios, { RawAxiosRequestConfig } from "axios";

const api = axios.create({});

export async function makeRequest(
  options?: RawAxiosRequestConfig
) {
  return api({
    ...options,
    headers: {
      ...options?.headers,
    },
    withCredentials: true,
  })
    .then((res: any) => res.data)
    .catch((e: any) =>
      Promise.reject(e.response ? e.response.data : "Network error")
    );
}

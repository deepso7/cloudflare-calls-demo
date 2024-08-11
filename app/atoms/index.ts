import { atom } from "jotai";

export const sessionAtom = atom<{
  pc: RTCPeerConnection;
  sessionId: string;
} | null>(null);

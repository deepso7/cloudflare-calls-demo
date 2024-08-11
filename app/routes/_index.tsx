import type { MetaFunction } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Terminal } from "lucide-react";
import { PublishOrSubscribeTrack } from "../components/tracks";

export const meta: MetaFunction = () => {
  return [
    { title: "Cloudflare Calls Demo" },
    { name: "description", content: "Demo for Cloudflare Calls" },
  ];
};

export default function Index() {
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);

  const [sessionId, setSessionId] = useState("");

  const initPeerConnection = async () => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.cloudflare.com:3478",
        },
      ],
      bundlePolicy: "max-bundle",
    });

    // in order for the ICE connection to be established, there must
    // be at least one track present, but since we want each peer
    // connection and session to have tracks explicitly pushed and
    // pulled, we can add an empty audio track here to force the
    // connection to be established.
    peerConnection.addTransceiver("audio", {
      direction: "inactive",
    });

    const localOffer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(localOffer);

    const localDescription = peerConnection.localDescription;

    const resp = await fetch("/api/create-session", {
      method: "POST",
      body: JSON.stringify({
        sessionDescription: localDescription,
      }),
    }).then((res) => res.json());

    console.log({ resp });

    const connected = new Promise((res, rej) => {
      // timeout after 5s
      setTimeout(rej, 5000);
      const iceConnectionStateChangeHandler = () => {
        if (peerConnection.iceConnectionState === "connected") {
          peerConnection.removeEventListener(
            "iceconnectionstatechange",
            iceConnectionStateChangeHandler
          );
          res(undefined);
        }
      };
      peerConnection.addEventListener(
        "iceconnectionstatechange",
        iceConnectionStateChangeHandler
      );
    });

    await peerConnection.setRemoteDescription(resp.sessionDescription);

    await connected;

    setPeerConnection(peerConnection);
    setSessionId(resp.sessionId);
  };

  return (
    <div className="vertical center">
      <div className="vertical center debug space-y-10 w-1/3">
        <h1 className="text-2xl pt-12 underline">Cloudflare Calls Demo</h1>
        <Button disabled={!!sessionId} onClick={initPeerConnection}>
          Init Session
        </Button>
        {sessionId ? <SessionIdBox sessionId={sessionId} /> : null}
        <PublishOrSubscribeTrack />
      </div>
    </div>
  );
}

const SessionIdBox = ({ sessionId }: { sessionId: string }) => {
  return (
    <Alert>
      <Terminal className="h-4 w-4" />
      <AlertTitle>{sessionId}</AlertTitle>
      <AlertDescription>{"Here's your session id"}</AlertDescription>
    </Alert>
  );
};

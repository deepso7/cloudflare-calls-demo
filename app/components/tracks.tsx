import { useMutation } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../atoms";

export const PublishOrSubscribeTrack = () => {
  const session = useAtomValue(sessionAtom);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Initialize a session first");

      const media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      const transceivers = media.getTracks().map((track) =>
        session.pc.addTransceiver(track, {
          direction: "sendonly",
        })
      );

      await session.pc.setLocalDescription(await session.pc.createOffer());

      const resp = await fetch("/api/new-track", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.sessionId,
          sessionDescription: session.pc.localDescription,
          tracks: transceivers.map(({ mid, sender }) => ({
            location: "local",
            mid,
            trackName: sender.track?.id,
          })),
        }),
      }).then((res) => res.json());

      console.log({ resp });

      // We take the answer we got from the Calls API and set it as the
      // peer connection's remote description.
      await session.pc.setRemoteDescription(
        new RTCSessionDescription(resp.sessionDescription)
      );
    },
    onError: (e) => {
      console.error("error while publish mutation", e);
    },
  });

  const subscribeTrack = useMutation({
    mutationFn: async ({ remoteSessionId }: { remoteSessionId: string }) => {
      if (!session) throw new Error("Initialize a session first");

      const sessionResp = (await fetch(
        `/api/get-session/${remoteSessionId}`
      ).then((res) => res.json())) as {
        tracks: {
          location: string;
          trackName: string;
          mid: string;
          status: "active" | "inactive";
        }[];
      };

      const tracksToPull = sessionResp.tracks.map((t) => ({
        location: "remote",
        trackName: t.trackName,
        sessionId: remoteSessionId,
      }));

      const resp = await fetch("/api/new-track", {
        method: "POST",
        body: JSON.stringify({
          tracks: tracksToPull,
        }),
      }).then((res) => res.json());

      console.log({ resp });

      // We set up this promise before updating local and remote descriptions
      // so the "track" event listeners are already in place before they fire.
      const resolvingTracks = Promise.all(
        resp.tracks.map(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ({ mid }) =>
            // This will resolve when the track for the corresponding mid is added.
            new Promise((res, rej) => {
              setTimeout(rej, 5000);
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const handleTrack = ({ transceiver, track }) => {
                if (transceiver.mid !== mid) return;
                session.pc.removeEventListener("track", handleTrack);
                res(track);
              };
              session.pc.addEventListener("track", handleTrack);
            })
        )
      );

      // Handle renegotiation, this will always be true when pulling tracks
      if (resp.requiresImmediateRenegotiation) {
        // We got a session description from the remote in the response,
        // we need to set it as the remote description
        session.pc.setRemoteDescription(resp.sessionDescription);
        // Create and set the answer as local description
        await session.pc.setLocalDescription(await session.pc.createAnswer());
        // Send our answer back to the Calls API
        const renegotiateResponse = await fetch("/api/renegotiate", {
          method: "POST",
          body: JSON.stringify({
            sessionId: remoteSessionId,
            sessionDescription: session.pc.currentLocalDescription,
          }),
        }).then((res) => res.json());
        if (renegotiateResponse.errorCode) {
          throw new Error(renegotiateResponse.errorDescription);
        }
      }

      // Now we wait for the tracks to resolve
      const pulledTracks = await resolvingTracks;

      const remoteVideoStream = new MediaStream();
      // remoteVideo.srcObject = remoteVideoStream;
      pulledTracks.forEach((t) => remoteVideoStream.addTrack(t));
    },
  });

  return (
    <section className="horizontal center space-x-4 w-full">
      <Button className="w-1/3" onClick={() => publishMutation.mutate()}>
        Publish Track
      </Button>
      <Button className="w-1/3">Subscribe Track</Button>
    </section>
  );
};

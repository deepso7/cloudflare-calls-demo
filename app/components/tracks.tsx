import { useMutation } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../atoms";
import { useState } from "react";
import { Input } from "./ui/input";
import { FormProvider, useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export const PublishOrSubscribeTrack = () => {
  const session = useAtomValue(sessionAtom);

  const [subscribe, setSubscribe] = useState(false);

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

  return (
    <section className="horizontal center space-x-4 w-full">
      {subscribe ? (
        <SubscribeForm setSubscribe={setSubscribe} />
      ) : (
        <>
          <Button className="w-1/3" onClick={() => publishMutation.mutate()}>
            Publish Track
          </Button>
          <Button className="w-1/3" onClick={() => setSubscribe(true)}>
            Subscribe Track
          </Button>
        </>
      )}
    </section>
  );
};

const SubscribeForm = ({
  setSubscribe,
}: {
  setSubscribe: (val: false) => void;
}) => {
  const session = useAtomValue(sessionAtom);

  const formSchema = z.object({
    sessionId: z.string(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const subscribeTrack = useMutation({
    mutationFn: async (remoteSessionId: string) => {
      if (!session) throw new Error("Initialize a session first");
      if (session.sessionId === remoteSessionId)
        throw new Error(
          "local and remote session id cannot be same, don't just copy paste from above"
        );

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

      console.log({ sessionResp });

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
    <div className="w-full horizontal vertical center space-y-4">
      <Button variant="outline" onClick={() => setSubscribe(false)}>
        Go Back
      </Button>
      <FormProvider {...form}>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((val) => {
              subscribeTrack.mutateAsync(val.sessionId);
            })}
            className="space-y-4 w-2/3"
          >
            <FormField
              control={form.control}
              name="sessionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Id</FormLabel>
                  <FormControl>
                    <Input placeholder="xxxxx" {...field} />
                  </FormControl>
                  <FormDescription>
                    Session Id copied from other tab
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Submit</Button>
          </form>
        </Form>
      </FormProvider>
    </div>
  );
};

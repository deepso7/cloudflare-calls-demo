import { ActionFunctionArgs, json } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as {
    sessionId?: string;
    sessionDescription?: RTCSessionDescription;
    tracks?: {
      location: "local";
      mi: string;
      trackName: string;
    }[];
  };

  console.log({ body });

  const resp = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${process.env.CLOUDFLARE_APP_ID}/sessions/${body.sessionId}/tracks/new`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify({
        sessionDescription: body.sessionDescription
          ? {
              sdp: body.sessionDescription.sdp,
              type: "offer",
            }
          : undefined,
        tracks: body.tracks,
      }),
    }
  ).then((res) => res.json());

  console.log({ resp });

  return json(resp);
}

import { ActionFunctionArgs, json } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as {
    sessionDescription: RTCSessionDescription;
  };

  console.log({ body });

  const { sessionId, sessionDescription } = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${process.env.CLOUDFLARE_APP_ID}/sessions/new`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify({
        sessionDescription: body.sessionDescription,
      }),
    }
  ).then((res) => res.json());

  console.log({ sessionId, sessionDescription });

  return json({ sessionId, sessionDescription });
}

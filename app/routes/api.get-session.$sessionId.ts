import { json, LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  const { sessionId } = params;

  const resp = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${process.env.CLOUDFLARE_APP_ID}/sessions/${sessionId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      },
    }
  ).then((res) => res.json());

  console.log({ resp });

  return json(resp);
}

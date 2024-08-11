import { Button } from "./ui/button";

export const PublishOrSubscribeTrack = () => {
  return (
    <section className="horizontal center space-x-4 w-full">
      <Button className="w-1/3">Publish Track</Button>
      <Button className="w-1/3">Subscribe Track</Button>
    </section>
  );
};

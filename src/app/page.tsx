import { MallExperience } from "@/components/MallExperience";

/**
 * Server shell. The experience itself is a client component (WebGL, input, audio);
 * this page only provides the document landmark and a no-JavaScript message.
 */
export default function Home() {
  return (
    <main className="relative h-full w-full overflow-hidden bg-[#0f0d0a]">
      <h1 className="sr-only">MallVerse, a virtual shopping mall</h1>
      <MallExperience />
      <noscript>
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <p className="max-w-md text-ivory">MallVerse is an interactive 3D experience and needs JavaScript enabled to run.</p>
        </div>
      </noscript>
    </main>
  );
}

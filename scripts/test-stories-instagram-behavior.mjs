import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stories = readFileSync("src/components/StoriesSection.tsx", "utf8");

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

includesAll(stories, [
  "function StoryViewer",
  "autoPlay",
  "playsInline",
  "muted",
  "controls={false}",
  "controlsList=\"nodownload noplaybackrate noremoteplayback\"",
  "disablePictureInPicture",
  "pointer-events-none absolute inset-0 h-full w-full object-cover",
  "mediaClassName=\"pointer-events-none\"",
  "interactive={false}",
  "data-rifapro-story-viewer",
  "data-rifapro-story-thumb",
  "[stories-debug]",
  "video.play()",
  "video.pause()",
  "onEnded={onNext}",
  "onTimeUpdate={handleVideoProgress}"
], "Stories de video estilo Instagram");

includesAll(stories, [
  "requestAnimationFrame(animate)",
  "progressRef.current",
  "durationMs",
  "isTimedStory",
  "if (!isHeld)",
  "onNext();"
], "Timer automatico para imagem/story nao nativo");

includesAll(stories, [
  "onMouseDown={beginHold}",
  "onMouseUp={endHold}",
  "onTouchStart={beginHold}",
  "onTouchEnd={endHold}",
  "suppressTapRef",
  "handleSideTap(event, onPrev)",
  "handleSideTap(event, onNext)",
  "w-1/2"
], "Navegacao e pausa por pressionar");

assert(!stories.includes("muted={false} controls={false}"), "Story viewer nao deve iniciar video com audio ativo.");
assert(!stories.includes("className=\"relative h-full w-full flex-1\" onClick={onNext}"), "Story viewer nao deve avancar por clique global unico.");
assert(!stories.includes("VolumeX"), "Story viewer publico nao deve exibir controle de som.");
assert(!stories.includes("Volume2"), "Story viewer publico nao deve exibir controle de som.");
assert(!stories.includes("aria-label=\"Fechar story\""), "Story viewer publico nao deve exibir botao fechar.");

console.log("stories-instagram-behavior: ok");

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
  "muted={muted}",
  "controls={false}",
  "video.play()",
  "video.pause()",
  "onEnded={onNext}",
  "onTimeUpdate={handleVideoProgress}",
  "setMuted(true)",
  "VolumeX",
  "Volume2"
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
  "handleSideTap(event, onNext)"
], "Navegacao e pausa por pressionar");

assert(!stories.includes("muted={false} controls={false}"), "Story viewer nao deve iniciar video com audio ativo.");
assert(!stories.includes("className=\"relative h-full w-full flex-1\" onClick={onNext}"), "Story viewer nao deve avancar por clique global unico.");

console.log("stories-instagram-behavior: ok");

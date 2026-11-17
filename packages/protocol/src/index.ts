export type SoundSummary = {
  id: string;
  name: string;
  /** Present when the sound has an image, and different for every image, so it can key a cache. */
  imageId?: string;
};

export type PluginToApp =
  | { type: "listSounds"; requestId: string }
  /** With a `requestId` the app answers `playResult`, saying whether the sound could be played. */
  | { type: "play"; soundId: string; requestId?: string }
  | { type: "stopAll" }
  | { type: "getImage"; requestId: string; soundId: string };

export type AppToPlugin =
  | { type: "sounds"; requestId: string; sounds: SoundSummary[] }
  | { type: "soundsChanged"; sounds: SoundSummary[] }
  | { type: "playResult"; requestId: string; ok: boolean }
  /** `image` is a PNG data URL, or null when the sound has no image. */
  | { type: "image"; requestId: string; image: string | null };

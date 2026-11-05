export type SoundSummary = { id: string; name: string };

export type PluginToApp =
  | { type: "listSounds"; requestId: string }
  | { type: "play"; soundId: string }
  | { type: "stopAll" };

export type AppToPlugin =
  | { type: "sounds"; requestId: string; sounds: SoundSummary[] }
  | { type: "soundsChanged"; sounds: SoundSummary[] };

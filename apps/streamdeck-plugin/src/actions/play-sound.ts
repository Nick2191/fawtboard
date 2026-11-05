import streamDeck, { action, KeyDownEvent, SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import type { SoundSummary } from "@fawtboard/protocol";
import { appClient } from "../app-client";

const PLAY_UUID = "com.nick2191.fawtboard.play";

type PlaySoundSettings = { soundId?: string };

/** Payload shape expected by sdpi-components' `datasource` on <sdpi-select>. */
function soundItems(sounds: SoundSummary[] | null): JsonValue {
	const items = sounds
		? sounds.map((s) => ({ label: s.name, value: s.id }))
		: [{ label: "fawtboard app not running", value: "", disabled: true }];
	return { event: "getSounds", items };
}

@action({ UUID: PLAY_UUID })
export class PlaySound extends SingletonAction<PlaySoundSettings> {
	constructor() {
		super();
		// The PI uses hot-reload, so pushing a fresh list updates an open dropdown.
		appClient.on("soundsChanged", (sounds) => {
			if (streamDeck.ui.action?.manifestId === PLAY_UUID) {
				void streamDeck.ui.sendToPropertyInspector(soundItems(sounds));
			}
		});
	}

	override async onKeyDown(ev: KeyDownEvent<PlaySoundSettings>): Promise<void> {
		const { soundId } = ev.payload.settings;
		if (!soundId || !appClient.send({ type: "play", soundId })) await ev.action.showAlert();
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, PlaySoundSettings>): Promise<void> {
		const payload = ev.payload as { event?: string } | null;
		if (payload?.event !== "getSounds") return;
		await streamDeck.ui.sendToPropertyInspector(soundItems(await appClient.listSounds()));
	}
}

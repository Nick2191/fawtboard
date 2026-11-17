import streamDeck, {
	action,
	type Action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
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
	/** Which sound each visible key plays, by action id. */
	private readonly soundIds = new Map<string, string | undefined>();
	/** The image id each visible key currently shows; absent while it shows the stock key image. */
	private readonly shown = new Map<string, string>();
	/** Images already fetched from the app, by image id. An id never changes what it points to. */
	private readonly images = new Map<string, Promise<string | null>>();

	constructor() {
		super();
		appClient.on("soundsChanged", (sounds) => {
			for (const key of this.actions) void this.showImage(key);
			// The PI uses hot-reload, so pushing a fresh list updates an open dropdown.
			if (streamDeck.ui.action?.manifestId === PLAY_UUID) {
				void streamDeck.ui.sendToPropertyInspector(soundItems(sounds));
			}
		});
	}

	override onWillAppear(ev: WillAppearEvent<PlaySoundSettings>): Promise<void> {
		this.soundIds.set(ev.action.id, ev.payload.settings.soundId);
		return this.showImage(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<PlaySoundSettings>): void {
		this.soundIds.delete(ev.action.id);
		this.shown.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlaySoundSettings>): Promise<void> {
		this.soundIds.set(ev.action.id, ev.payload.settings.soundId);
		return this.showImage(ev.action);
	}

	override async onKeyDown(ev: KeyDownEvent<PlaySoundSettings>): Promise<void> {
		const { soundId } = ev.payload.settings;
		if (!soundId || !(await appClient.play(soundId))) await ev.action.showAlert();
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, PlaySoundSettings>): Promise<void> {
		const payload = ev.payload as { event?: string } | null;
		if (payload?.event !== "getSounds") return;
		await streamDeck.ui.sendToPropertyInspector(soundItems(await appClient.listSounds()));
	}

	/**
	 * Puts the image of the key's sound on the key, or the stock image when the sound has none.
	 * An icon the user chose in Stream Deck itself still wins; Stream Deck handles that.
	 */
	private async showImage(key: Action<PlaySoundSettings>): Promise<void> {
		if (!key.isKey()) return;
		const soundId = this.soundIds.get(key.id);
		const imageId = appClient.sounds.find((s) => s.id === soundId)?.imageId;
		if (this.shown.get(key.id) === imageId) return;

		if (!soundId || !imageId) {
			this.shown.delete(key.id);
			await key.setImage();
			return;
		}
		this.shown.set(key.id, imageId);
		const image = await this.loadImage(soundId, imageId);
		// The key may have been given another sound, or the sound another image, while this loaded.
		if (this.shown.get(key.id) !== imageId) return;
		if (image) await key.setImage(image);
		// Forget the attempt so the next list change tries again.
		else this.shown.delete(key.id);
	}

	private loadImage(soundId: string, imageId: string): Promise<string | null> {
		let image = this.images.get(imageId);
		if (!image) {
			image = appClient.image(soundId);
			this.images.set(imageId, image);
			void image.then((data) => {
				if (data === null) this.images.delete(imageId);
			});
		}
		return image;
	}
}

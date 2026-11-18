import streamDeck from "@elgato/streamdeck";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type { AppToPlugin, PluginToApp, SoundSummary } from "@fawtboard/protocol";

const FAWTBOARD_PORT = 39217;
const RECONNECT_MS = 2000;
const REQUEST_TIMEOUT_MS = 2000;

/** Connection to the fawtboard desktop app; reconnects forever while the plugin runs. */
class AppClient extends EventEmitter<{ soundsChanged: [SoundSummary[]] }> {
	private socket: WebSocket | null = null;
	private readonly pending = new Map<string, (reply: AppToPlugin) => void>();
	connected = false;
	/** The app's latest sound list. Kept across a disconnect so keys hold on to their images. */
	sounds: SoundSummary[] = [];

	connect(): void {
		// The app offers to update the plugin when this is older than the one it bundles.
		const version = encodeURIComponent(streamDeck.info.plugin.version);
		const socket = new WebSocket(`ws://127.0.0.1:${FAWTBOARD_PORT}/?version=${version}`);
		this.socket = socket;
		socket.on("open", () => {
			this.connected = true;
			// Changes are pushed from here on, but the list as it stands has to be asked for.
			void this.listSounds().then((sounds) => {
				if (sounds) this.setSounds(sounds);
			});
		});
		socket.on("message", (data) => {
			let msg: AppToPlugin;
			try {
				msg = JSON.parse(String(data)) as AppToPlugin;
			} catch {
				return;
			}
			if (msg.type === "soundsChanged") this.setSounds(msg.sounds);
			else this.pending.get(msg.requestId)?.(msg);
		});
		// "error" is always followed by "close"; reconnect only from "close" to avoid double timers.
		socket.on("error", () => {});
		socket.on("close", () => {
			this.connected = false;
			if (this.socket === socket) setTimeout(() => this.connect(), RECONNECT_MS);
		});
	}

	private setSounds(sounds: SoundSummary[]): void {
		this.sounds = sounds;
		this.emit("soundsChanged", sounds);
	}

	/** Returns false when the app is not reachable. */
	send(msg: PluginToApp): boolean {
		if (!this.connected || !this.socket) return false;
		this.socket.send(JSON.stringify(msg));
		return true;
	}

	/** Sends a request and resolves with the app's reply, or null when it is unreachable or silent. */
	private ask(build: (requestId: string) => PluginToApp): Promise<AppToPlugin | null> {
		const requestId = randomUUID();
		if (!this.send(build(requestId))) return Promise.resolve(null);
		const { promise, resolve } = Promise.withResolvers<AppToPlugin | null>();
		const settle = (reply: AppToPlugin | null): void => {
			clearTimeout(timer);
			this.pending.delete(requestId);
			resolve(reply);
		};
		const timer = setTimeout(() => settle(null), REQUEST_TIMEOUT_MS);
		this.pending.set(requestId, settle);
		return promise;
	}

	/** Sound list from the app, or null when it is not running / does not answer in time. */
	async listSounds(): Promise<SoundSummary[] | null> {
		const reply = await this.ask((requestId) => ({ type: "listSounds", requestId }));
		return reply?.type === "sounds" ? reply.sounds : null;
	}

	/** Resolves false when the app is not running, or says the sound is gone or can't be played. */
	async play(soundId: string): Promise<boolean> {
		if (!this.connected) return false;
		const reply = await this.ask((requestId) => ({ type: "play", soundId, requestId }));
		// Only an explicit "no" is a failure: an older app plays the sound but never answers.
		return reply?.type === "playResult" ? reply.ok : true;
	}

	/** A sound's image as a data URL, or null when it has none or the app does not answer. */
	async image(soundId: string): Promise<string | null> {
		const reply = await this.ask((requestId) => ({ type: "getImage", soundId, requestId }));
		return reply?.type === "image" ? reply.image : null;
	}
}

export const appClient = new AppClient();

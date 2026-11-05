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
	private readonly pending = new Map<string, (sounds: SoundSummary[]) => void>();
	connected = false;

	connect(): void {
		const socket = new WebSocket(`ws://127.0.0.1:${FAWTBOARD_PORT}`);
		this.socket = socket;
		socket.on("open", () => {
			this.connected = true;
		});
		socket.on("message", (data) => {
			let msg: AppToPlugin;
			try {
				msg = JSON.parse(String(data)) as AppToPlugin;
			} catch {
				return;
			}
			if (msg.type === "sounds") {
				this.pending.get(msg.requestId)?.(msg.sounds);
				this.pending.delete(msg.requestId);
			} else if (msg.type === "soundsChanged") {
				this.emit("soundsChanged", msg.sounds);
			}
		});
		// "error" is always followed by "close"; reconnect only from "close" to avoid double timers.
		socket.on("error", () => {});
		socket.on("close", () => {
			this.connected = false;
			if (this.socket === socket) setTimeout(() => this.connect(), RECONNECT_MS);
		});
	}

	/** Returns false when the app is not reachable. */
	send(msg: PluginToApp): boolean {
		if (!this.connected || !this.socket) return false;
		this.socket.send(JSON.stringify(msg));
		return true;
	}

	/** Sound list from the app, or null when it is not running / does not answer in time. */
	listSounds(): Promise<SoundSummary[] | null> {
		const requestId = randomUUID();
		if (!this.send({ type: "listSounds", requestId })) return Promise.resolve(null);
		const { promise, resolve } = Promise.withResolvers<SoundSummary[] | null>();
		const timer = setTimeout(() => {
			this.pending.delete(requestId);
			resolve(null);
		}, REQUEST_TIMEOUT_MS);
		this.pending.set(requestId, (sounds) => {
			clearTimeout(timer);
			resolve(sounds);
		});
		return promise;
	}
}

export const appClient = new AppClient();

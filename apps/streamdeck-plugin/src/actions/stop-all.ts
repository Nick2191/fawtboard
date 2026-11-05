import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { appClient } from "../app-client";

@action({ UUID: "com.nick2191.fawtboard.stop-all" })
export class StopAll extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		if (!appClient.send({ type: "stopAll" })) await ev.action.showAlert();
	}
}

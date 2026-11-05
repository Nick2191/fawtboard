import streamDeck from "@elgato/streamdeck";

import { appClient } from "./app-client";
import { PlaySound } from "./actions/play-sound";
import { StopAll } from "./actions/stop-all";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new PlaySound());
streamDeck.actions.registerAction(new StopAll());

appClient.connect();
streamDeck.connect();

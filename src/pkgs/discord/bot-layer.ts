import { Layer } from "effect";
import { DiscordGatewayEventBus } from "./bus/event-bus";
import { DiscordGateway } from "./gateway";
import { DiscordHttp } from "./http";
import { DiscordCommandRegistry } from "./registry";

export const BotLayerLive = Layer.mergeAll(
	DiscordHttp.Default,
	DiscordCommandRegistry.Default,
	DiscordGateway.Default,
	DiscordGatewayEventBus.Default,
);

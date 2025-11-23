import { Layer } from "effect";
import { DiscordEventCoordinator } from "./coordinator";
import { DiscordGatewayEventBus } from "./event-bus";
import { DiscordGateway } from "./gateway";
import { DiscordHttp } from "./http";
import { DiscordCommandRegistry } from "./registry";

export const BotLayerLive = Layer.mergeAll(
	DiscordHttp.Default,
	DiscordCommandRegistry.Default,
	DiscordGateway.Default,
	DiscordGatewayEventBus.Default,
	DiscordEventCoordinator.Default,
);

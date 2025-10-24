import { hex } from "@scure/base";
import { AddressType, Client as DiceClient, Ipv4Address, Ipv6Address } from "@xkore/dice";
import { createSocket } from "dgram";
import { rmSync } from "fs";
import { Level } from "level";
import logger, { LogLevelNumbers } from "loglevel";
import { Overlay } from "../models/Overlay";
import { spawnIntegrationBootstrapOverlays } from "./spawnIntegrationBootstrapOverlays";

logger.setLevel(process.env.LOG_LEVEL ? (parseInt(process.env.LOG_LEVEL) as LogLevelNumbers) : 5);

export const INTEGRATION_TEST_TIMEOUT_MS = 60_000;

export const spawnIntegrationOverlays = async (
	options: Partial<Overlay.Options> | undefined,
	callback: (bootstrapOverlays: [Overlay, Overlay, Overlay], overlays: [Overlay, Overlay]) => any
): Promise<void> => {
	await spawnIntegrationBootstrapOverlays(undefined, async (bootstrapOverlays) => {
		const bootstrap6Addresses = bootstrapOverlays.map((bootstrapOverlay) => bootstrapOverlay.diceClient.overlays[AddressType.IPv6]!.external!);
		const bootstrap4Addresses = bootstrapOverlays.map((bootstrapOverlay) => bootstrapOverlay.diceClient.overlays[AddressType.IPv4]!.external!);

		const bootstrapTargets = bootstrapOverlays.map((overlay) => overlay.node);

		const overlays: Array<Overlay> = [];

		for (let i = 0; i < 2; i++) {
			const socket6 = createSocket("udp6");

			await new Promise<void>((resolve) => {
				socket6.bind(undefined, "::1", () => resolve());
			});

			const socket4 = createSocket("udp4");

			await new Promise<void>((resolve) => {
				socket4.bind(undefined, "127.0.0.1", () => resolve());
			});

			const diceClient = new DiceClient({
				[AddressType.IPv6]: {
					bootstrapAddresses: bootstrap6Addresses,
					isPrefixFilteringDisabled: true,
					socket: socket6,
				},
				[AddressType.IPv4]: {
					bootstrapAddresses: bootstrap4Addresses,
					isPrefixFilteringDisabled: true,
					socket: socket4,
				},
				logger,
				...options,
			});

			diceClient.overlays[AddressType.IPv6]!.external = Ipv6Address.fromAddressInfo(socket6.address());
			diceClient.overlays[AddressType.IPv4]!.external = Ipv4Address.fromAddressInfo(socket4.address());

			const dbId = hex.encode(crypto.getRandomValues(new Uint8Array(16)));

			const database = new Level<Uint8Array, Uint8Array>(dbId, { keyEncoding: "view", valueEncoding: "view" });

			const overlay = new Overlay({
				bootstrapTargets,
				database,
				diceClient,
				logger,
				...options,
			});

			overlays.push(overlay);
		}

		for (const overlayA of overlays) {
			for (const overlayB of overlays) {
				if (overlayA.diceClient.diceAddress.toString() === overlayB.diceClient.diceAddress.toString()) continue;

				overlayA.diceClient.overlays[AddressType.IPv6]?.coordinatorMap.set(
					overlayB.diceClient.overlays[AddressType.IPv6]?.external!.key!,
					overlayB.diceClient.overlays[AddressType.IPv6]?.external!
				);
				overlayA.diceClient.overlays[AddressType.IPv4]?.coordinatorMap.set(
					overlayB.diceClient.overlays[AddressType.IPv4]?.external!.key!,
					overlayB.diceClient.overlays[AddressType.IPv4]?.external!
				);

				overlayA.nodes.putNode(overlayB.node);
			}

			await overlayA.open(false);
			clearInterval(overlayA.diceClient.overlays[AddressType.IPv6]?.healthcheckInterval);
			clearInterval(overlayA.diceClient.overlays[AddressType.IPv4]?.healthcheckInterval);
			clearInterval(overlayA.healthcheckInterval);
			clearInterval(overlayA.pruneInterval);
		}

		try {
			await callback(bootstrapOverlays, overlays as [Overlay, Overlay]);
		} finally {
			for (const overlay of overlays) {
				for (const diceOverlay of Object.values(overlay.diceClient.overlays)) {
					diceOverlay.socket.close();
				}

				overlay.close();

				await overlay.database.close();
				rmSync(overlay.database.location, { recursive: true });
			}
		}
	});
};

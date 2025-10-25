import { base32crockford, hex } from "@scure/base";
import { AddressType, Client as DiceClient, Ipv4Address, Ipv6Address } from "@xkore/dice";
import { Keys, Overlay } from "@xkore/dices";
import { program } from "commander";
import { createSocket } from "dgram";
import dotenv from "dotenv";
import { Level } from "level";
import logger, { LogLevelNumbers } from "loglevel";
import { CommandOptions } from "./methods/CommandOptions.js";
import { optionalTransform } from "./methods/optionalTransform.js";

dotenv.config();

type Options = CommandOptions<never, "concurrency" | "ipv4" | "ipv6" | "logLevel" | "ports" | "secretKeys">;

program
	.version("0.0.0", "-v, --vers", "output the current version")
	.option("-c, --concurrency <number>", "Concurrency of find operations on the overlay network")
	.option("-4, --ipv4 <string>", "Ipv4 address")
	.option("-6, --ipv6 <string>", "Ipv6 address")
	.option("-l, --log-level <number>", "Log level 0-5, 0 being all logs")
	.option("-p, --ports <string>", "Comma separated list of ports")
	.option("-s, --secret-keys <string>", "Comma separated list of secret keys as hex");

const main = async () => {
	const options = program.parse().opts<Options>();

	const concurrency = optionalTransform(options.concurrency || process.env.CONCURRENCY, (value) => parseInt(value)) || 3;
	const ipv4 = optionalTransform(options.ipv4 || process.env.IPV4, (value) => value);
	const ipv6 = optionalTransform(options.ipv6 || process.env.IPV6, (value) => value);
	const logLevel = optionalTransform(options.logLevel || process.env.LOG_LEVEL, (value) => parseInt(value) as LogLevelNumbers) || 1;
	const ports = optionalTransform(options.ports || process.env.PORTS, (value) => value.split(",").map((port) => parseInt(port))) || [5173];
	const secretKeys = optionalTransform(options.secretKeys || process.env.SECRET_KEYS, (value) => value.split(",").map((key) => hex.decode(key))) || [];

	logger.setLevel(logLevel);
	logger.info(
		`[MAIN] Configuration:\n${JSON.stringify(
			{
				concurrency,
				ipv4,
				ipv6,
				logLevel,
				ports,
				secretKeys: secretKeys.map((key) => hex.encode(key)),
			},
			null,
			4
		)}`
	);

	if (!ipv4 && !ipv6) {
		throw new Error("Must specify either --ipv4 or --ipv6");
	}

	if (secretKeys.length === 0) {
		throw new Error("Must specify at least one secret key via --secret-keys or SECRET_KEYS env var");
	}

	if (secretKeys.length !== ports.length) {
		throw new Error(`Number of secret keys (${secretKeys.length}) must match number of ports (${ports.length})`);
	}

	const overlays: Array<Overlay> = [];

	for (let i = 0; i < secretKeys.length; i++) {
		const secretKey = secretKeys[i];
		const port = ports[i];

		if (!secretKey || port === undefined) throw new Error("Invalid configuration");

		const keys = new Keys({ secretKey });

		const socket6 = createSocket("udp6");
		await new Promise<void>((resolve) => {
			socket6.bind(port, ipv6 || "::1", () => resolve());
		});

		const socket4 = createSocket("udp4");
		await new Promise<void>((resolve) => {
			socket4.bind(port, ipv4 || "127.0.0.1", () => resolve());
		});

		const diceClient = new DiceClient({
			[AddressType.IPv6]: {
				bootstrapAddresses: [],
				isPrefixFilteringDisabled: true,
				socket: socket6,
			},
			[AddressType.IPv4]: {
				bootstrapAddresses: [],
				isPrefixFilteringDisabled: true,
				socket: socket4,
			},
			concurrency,
			logger,
		});

		diceClient.overlays[AddressType.IPv6]!.external = Ipv6Address.fromAddressInfo(socket6.address());
		diceClient.overlays[AddressType.IPv4]!.external = Ipv4Address.fromAddressInfo(socket4.address());

		const database = new Level<Uint8Array, Uint8Array>(`data/${hex.encode(keys.publicKey)}`, { keyEncoding: "view", valueEncoding: "view" });

		const overlay = new Overlay({
			bootstrapTargets: [],
			database,
			diceClient,
			logger,
			secretKey,
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
	}

	await Promise.all(overlays.map((overlay) => overlay.open(false)));

	for (const overlay of overlays) {
		logger.info(
			`[MAIN] Bootstrap node:\n${JSON.stringify(
				{
					nodeId: base32crockford.encode(overlay.keys.nodeId),
					diceAddress: overlay.diceClient.diceAddress.toString(),
				},
				null,
				4
			)}`
		);
	}

	logger.info(`[MAIN] ${overlays.length} bootstrap nodes running. Press Ctrl+C to exit.`);
};

main();

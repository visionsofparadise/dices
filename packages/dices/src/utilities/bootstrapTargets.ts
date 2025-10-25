import { base32crockford } from "@scure/base";
import { AddressType, DiceAddress, Ipv4Address, Ipv6Address } from "@xkore/dice";
import { Target } from "../models/Target/Codec";

export const BOOTSTRAP_TARGETS: Array<Target> = [
	{
		nodeId: base32crockford.decode("F1W3EF5Z7M1K4EFHZRZ2FM6ZVTM8RCQE"),
		diceAddress: new DiceAddress({
			[AddressType.IPv6]: {
				address: new Ipv6Address({
					ip: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
					port: 8000,
				}),
			},
			[AddressType.IPv4]: {
				address: new Ipv4Address({
					ip: Uint8Array.from([127, 0, 0, 1]),
					port: 8000,
				}),
			},
		}),
	},
	{
		nodeId: base32crockford.decode("60ZJZR48TW7TNMHGWKGMX9Q24J9VARRV"),
		diceAddress: new DiceAddress({
			[AddressType.IPv6]: {
				address: new Ipv6Address({
					ip: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
					port: 8001,
				}),
			},
			[AddressType.IPv4]: {
				address: new Ipv4Address({
					ip: Uint8Array.from([127, 0, 0, 1]),
					port: 8001,
				}),
			},
		}),
	},
	{
		nodeId: base32crockford.decode("6HWDR7DP7CMNP4NRE9A0GFBE8H0D6E68"),
		diceAddress: new DiceAddress({
			[AddressType.IPv6]: {
				address: new Ipv6Address({
					ip: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
					port: 8002,
				}),
			},
			[AddressType.IPv4]: {
				address: new Ipv4Address({
					ip: Uint8Array.from([127, 0, 0, 1]),
					port: 8002,
				}),
			},
		}),
	},
];

import type { Overlay } from "..";
import { DicesOverlayError } from "../../Error";
import { RatchetKeysPublic } from "../../RatchetKeysItem/PublicCodec";

export const getOverlayInitiationKeys = async (overlay: Overlay, remoteNodeId: Uint8Array): Promise<RatchetKeysPublic> => {
	const value = await overlay.findValue(remoteNodeId);

	if (!value) {
		throw new DicesOverlayError(`No initiation keys found for nodeId`);
	}

	return value.initiationKeys;
};

import type { Overlay } from "..";
import { RatchetKeysItem } from "../../RatchetKeysItem";

export const loadOverlayRatchetKeys = async (overlay: Overlay): Promise<RatchetKeysItem> => {
	for await (const item of RatchetKeysItem.iterate(undefined, overlay)) {
		if (!item.rotatedAt) {
			overlay.logger?.debug("Loaded existing ratchet keys");

			return item;
		}
	}

	overlay.logger?.debug("Generating new ratchet keys");

	const newKeys = new RatchetKeysItem();
	await newKeys.put(overlay);

	return newKeys;
};

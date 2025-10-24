import type { Overlay } from "..";
import { RatchetKeysItem } from "../../RatchetKeysItem";
import { RatchetStateItem } from "../../RatchetStateItem";

const MAX_CONCURRENT_PRUNE = 10;

export const pruneOverlay = async (overlay: Overlay): Promise<void> => {
	const now = Date.now();

	// Prune rotated ratchet keys
	const keysToDelete: Uint8Array[] = [];
	for await (const ratchetKeys of RatchetKeysItem.iterate(undefined, overlay)) {
		if (ratchetKeys.rotatedAt && now - ratchetKeys.rotatedAt > overlay.options.ratchetKeyTtl) {
			keysToDelete.push(ratchetKeys.key);
		}
	}

	// Delete keys in batches
	for (let i = 0; i < keysToDelete.length; i += MAX_CONCURRENT_PRUNE) {
		await Promise.all(
			keysToDelete.slice(i, i + MAX_CONCURRENT_PRUNE).map((key) => overlay.database.del(key))
		);
	}

	// Prune skipped keys from ratchet states
	const statesToPrune: RatchetStateItem[] = [];
	for await (const ratchetState of RatchetStateItem.iterate(undefined, overlay)) {
		statesToPrune.push(ratchetState);
	}

	// Process states in batches
	for (let i = 0; i < statesToPrune.length; i += MAX_CONCURRENT_PRUNE) {
		await Promise.all(
			statesToPrune.slice(i, i + MAX_CONCURRENT_PRUNE).map(async (state) => {
				state.pruneSkippedKeys();
				await state.put(overlay);
			})
		);
	}
};

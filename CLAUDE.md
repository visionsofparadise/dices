# DICES - Project Context

**Last Updated:** 2025-10-24

## Current Status

**Implementation:** ✅ Complete - all phases 0-14 finished
- ✅ Project setup, Keys, Node, Nodes, RoutingTable models
- ✅ RatchetKeysItem (initiation keys with ML-KEM + X25519)
- ✅ Value model (DHT record with recoverable signatures)
- ✅ RatchetStateItem (per-peer ratchet sessions)
- ✅ Envelope and CipherData (wire format with XChaCha20-Poly1305)
- ✅ Key derivation (RootChain, KeyChain via HKDF)
- ✅ Ratchet initialization, encryption, decryption
- ✅ Standalone wrap/unwrap functions with auto-fetch
- ✅ DHT operations and key rotation
- ✅ Cleanup/prune functionality
- ✅ Comprehensive test suite (92 tests, all passing)

**Build:** ✅ Builds successfully (93.72 KB ESM + DTS)

**Tests:** ✅ 92/92 tests passing (100%)
- 79 unit tests covering core crypto primitives
- 13 integration tests validating full protocol

## Test Coverage

**Unit Tests (79 tests):**
- KeyChain key derivation (14 tests) - HKDF, domain separation, caching
- RootChain key derivation (5 tests) - root key updates, ML-KEM integration
- CipherData encryption (10 tests) - XChaCha20-Poly1305, auth tags, tampering
- RatchetStateItem bounds (12 tests) - message/time limits, DoS protection
- Value signatures (7 tests) - signature creation, recovery, tampering detection
- Envelope codec (6 tests) - serialization, magic bytes, KEM ciphertext
- Keys model (25 tests) - identity, nodeId, signatures

**Integration Tests (13 tests):**
- Full ratchet encrypt/decrypt flow (2 tests)
- Out-of-order message handling with skipped keys
- DoS protection (1000 message skip limit)
- DH ratchet on remote key changes
- ML-KEM ratchet at bounds (100 messages)
- Signature recovery and verification
- Forward secrecy validation
- DHT operations (FIND_NODE, FIND_VALUE, PING)
- Bootstrap overlay spawning

## Blockers

None

## Implementation Fixes During Testing

1. **ML-KEM Seed Size** - Fixed `MlKemSeedCodec` from 32 to 64 bytes (ML-KEM-1024 requirement)
2. **ESM Import Paths** - Added `.js` extensions to all `@noble/post-quantum/ml-kem` imports
3. **API Changes**:
   - Changed `Keys.generate()` → `new Keys()`
   - Changed `RatchetKeysItem.generate()` → `new RatchetKeysItem()`
   - Added `initiationKeys` getter to `RatchetKeysItem`
4. **DH Ratchet Logic**:
   - Added automatic DH ratchet in `decryptMessage` when remote DH key changes
   - Added `RootChain.initializeSendingChain()` for responder's first send
   - Fixed responder initialization to not derive sending chain prematurely
5. **Test Framework** - Switched from Jest to Vitest for ESM compatibility
6. **API Simplification** (2025-10-25):
   - Extracted `wrap` and `unwrap` as standalone functions (not Overlay methods)
   - `wrap` now auto-fetches initiation keys when needed (no manual `getInitiationKeys` call required)
   - Updated all tests and documentation to use new simpler API

## Next Steps

1. Git commit test suite and fixes
2. Publish to NPM
3. Integrate with applications (yap, DCT, says)

## Key Context

### Architecture
- **Purpose:** Transport-agnostic quantum-resistant encryption layer for P2P applications
- **Package:** `@xkore/dices`
- **Core API:** Standalone functions `wrap(overlay, recipientNodeId, data) → Envelope` and `unwrap(overlay, envelope) → data`
- **Auto-fetch:** `wrap` automatically fetches initiation keys from DHT when needed (no manual `getInitiationKeys` required)
- **DHT:** Uses @xkore/dice for key discovery only (not message transport)

### Cryptography
- **ML-KEM-1024:** Quantum-resistant key encapsulation
- **X25519:** Hybrid classical DH for defense-in-depth
- **XChaCha20-Poly1305:** Authenticated encryption
- **HKDF-SHA256:** Key derivation with domain separation

### Key Models
```
Overlay (main class)
  ├─ Keys (secp256k1 identity, nodeId)
  ├─ RatchetKeysItem (initiation keys, INDEX_KEY: 0x10)
  ├─ RatchetStateItem (session state, INDEX_KEY: 0x11)
  ├─ Value (DHT record with recoverable signature)
  ├─ Envelope (wire format, magicBytes: "DICES")
  └─ Nodes (Kademlia routing table)
```

### Design Patterns
- **Item Pattern:** Database storage with static `get()`/`iterate()` and instance `put()`
- **Codec Pattern:** Separate Key/Value codecs using bufferfy
- **Overlay Pattern:** EventEmitter with method binding via `.bind(this, this)`
- **Terminology:** Uses 'data' not 'plaintext', 'local/remote' for identities

### Dependencies
- `@noble/curves`, `@noble/hashes`, `@noble/post-quantum` (crypto)
- `@xkore/dice` (DHT only)
- `level` (LevelDB storage)
- `bufferfy` (serialization)
- `kademlia-table` (routing)

### Configuration Options
```typescript
Overlay.Options {
  database: Level<Uint8Array, Uint8Array>
  diceClient: DiceClient
  secretKey: Uint8Array
  maxMessagesBeforeRotation?: 100  // default
  maxTimeBeforeRotation?: 3600000  // 1h default
  maxSkippedKeys?: 1000            // default
  pruneIntervalMs?: 3600000        // 1h default
  ratchetKeyTtl?: 3600000          // 1h default
}
```

## Parent

- **../CLAUDE.md**: DICES project-level understanding and strategic design

---

## Future Enhancements

### Security Improvements
- Replay attack detection (explicit tracking of seen message numbers per ratchetId)
- Timing attack hardening in `trySkippedKey` (dummy decryption when no candidates)
- Side-channel resistance documentation and validation

### Testing & Quality
- JSDoc documentation for all public APIs
- Performance benchmark tests (1000 messages/sec baseline)
- Fuzz testing for malformed envelopes (truncated ciphertext, invalid ML-KEM, signature recovery edge cases)
- Browser compatibility testing (IndexedDB adapter, CSPRNG shims)

### Features
- Multi-recipient encryption
- Sealed sender (cryptographic anonymity)
- Group ratchets
- Post-quantum X25519 replacement when standardized
- DHT redundancy modes with opt-in replication

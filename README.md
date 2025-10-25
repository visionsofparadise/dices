# DICES

Transport-agnostic quantum-resistant encryption for P2P applications.

## Overview

DICES (DICE Secure) is a quantum-resistant encryption layer built on a bounded triple ratchet protocol. It provides forward secrecy, backward secrecy, and quantum resistance through ML-KEM-1024 + X25519 hybrid key exchange with XChaCha20-Poly1305 authenticated encryption.

## Monorepo Structure

### Packages

#### [`packages/dices`](./packages/dices)

Core encryption library. ML-KEM-1024 + X25519 + XChaCha20-Poly1305 with bounded triple ratchet. Standalone `wrap`/`unwrap` functions with automatic key fetching from DHT.

**Package:** `@xkore/dices`

#### `packages/tsconfig`

Shared TypeScript configuration for monorepo packages and apps.

### Apps

#### [`apps/bootstrap`](./apps/bootstrap)

Bootstrap nodes for DICES network testing. Runs multiple overlay instances with configurable IPv4/IPv6 addresses and ports. Used for local development and integration testing.

## License

MIT

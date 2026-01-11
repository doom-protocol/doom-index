---
name: substreams-solana
description: Expert guidance for Substreams development on Solana (pump.fun focus). Use when creating/debugging Substreams projects, designing module architecture (map/store), working with Anchor IDLs for type-safe decoding, troubleshooting build/runtime errors, understanding CLI commands and file generation, or optimizing for production (holder_count, trades, events). Covers CLI workflow, manifest configuration, Rust module patterns, and common pitfalls.
---

# Substreams Solana Development

Expert-level guidance for building production Substreams on Solana.

## Quick Reference

| Task               | Command                                                   |
| ------------------ | --------------------------------------------------------- |
| Initialize project | `substreams init`                                         |
| Build & package    | `substreams build`                                        |
| Run with GUI       | `substreams gui ./substreams.yaml <module> -e <endpoint>` |
| Run streaming      | `substreams run ./substreams.yaml <module> -e <endpoint>` |
| Generate protobuf  | `substreams protogen ./substreams.yaml`                   |
| Package only       | `substreams pack ./substreams.yaml`                       |
| Inspect package    | `substreams info ./substreams.yaml`                       |
| Visualize DAG      | `substreams graph ./substreams.yaml`                      |
| Auth setup         | `substreams auth`                                         |

## Core Mental Model

```
Substreams IS:
├── Deterministic block → data transformation engine
├── WASM-based parallel processing
└── Composable module DAG

Substreams is NOT:
├── A database
├── A general analytics engine
└── A rule evaluation engine
```

**Responsibility Split:**

- **Substreams** → Extract facts, minimal state, emit DatabaseChanges
- **Database (Postgres/Clickhouse)** → Aggregate, query, analyze
- **Application layer** → Rules, alerts, time windows, USD rates

## Project Structure

```
my-substreams/
├── proto/
│   └── events.proto              # Protobuf definitions
├── idls/
│   ├── pump_fun.json             # Anchor IDL files
│   └── raydium_amm.json
├── src/
│   ├── lib.rs                    # Entry point, module exports
│   ├── pb/
│   │   └── mod.rs                # Auto-generated protobuf (DO NOT EDIT)
│   ├── idl/
│   │   ├── mod.rs                # IDL type re-exports
│   │   ├── pump_fun.rs           # Generated from IDL
│   │   └── raydium_amm.rs
│   ├── modules/
│   │   ├── mod.rs
│   │   ├── map_trades.rs         # map modules
│   │   └── store_holders.rs      # store modules
│   └── utils/
│       ├── mod.rs
│       ├── keys.rs               # Key generation helpers
│       └── decode.rs             # Decoding utilities
├── substreams.yaml               # Manifest
├── Cargo.toml
└── buf.gen.yaml                  # Optional: buf configuration
```

## File Generation Map

| Command                          | Generates               | Location                                 |
| -------------------------------- | ----------------------- | ---------------------------------------- |
| `substreams build`               | `.spkg` package         | `./` root                                |
| `substreams build`               | Protobuf Rust code      | `src/pb/`                                |
| `substreams build`               | WASM binary             | `target/wasm32-unknown-unknown/release/` |
| `substreams protogen`            | Protobuf Rust code only | `src/pb/`                                |
| `substreams init`                | Project scaffold        | Current directory                        |
| `cargo build --target wasm32...` | WASM binary only        | `target/`                                |

## Module Types

### map Module (Stateless)

```rust
#[substreams::handlers::map]
fn map_trades(block: Block) -> Result<Trades, Error> {
    // Pure function: input → output
    // NO side effects, NO state
}
```

**Use for:** Event extraction, filtering, normalization, DatabaseChanges

### store Module (Stateful)

```rust
#[substreams::handlers::store]
fn store_holder_count(trades: Trades, store: StoreAddInt64) {
    // Incremental state across blocks
    store.add(0, format!("hc:{}", mint), 1);
}
```

**Use for:** Counters, simple KV state for downstream modules

**NEVER use store for:** Persistent storage, full balance tracking, external queries

## Solana-Specific Patterns

### Unique Event Identification

Solana requires composite keys (tx hash alone is NOT unique):

```rust
fn event_key(sig: &str, ix_idx: u32, inner_idx: u32) -> String {
    format!("{}:{}:{}", sig, ix_idx, inner_idx)
}
```

### Source Types

```yaml
# For filtered blocks (recommended, 75% cost reduction)
inputs:
  - source: sf.solana.type.v1.Block

# For vote-excluded (most common)
inputs:
  - map: solana:blocks_without_votes

# For filtered by program
inputs:
  - map: solana:filtered_transactions_without_votes
```

### holder_count Strategy

Track Token Account balance changes (NOT transfers):

```rust
// old_amount == 0 && new_amount > 0 → holder +1
// old_amount > 0 && new_amount == 0 → holder -1
```

## IDL Type-Safe Pattern

### Directory Structure

```
src/idl/
├── mod.rs           # Re-exports
├── pump_fun.rs      # Generated/manual types
└── raydium_amm.rs
```

### mod.rs Pattern

```rust
pub mod pump_fun;
pub mod raydium_amm;

pub use pump_fun::*;
pub use raydium_amm::*;
```

### Decoding from IDL

```rust
use borsh::BorshDeserialize;

#[derive(BorshDeserialize, Debug)]
pub struct TradeEvent {
    pub mint: Pubkey,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub is_buy: bool,
    pub user: Pubkey,
    pub timestamp: i64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
}

// Discriminator from IDL (first 8 bytes of sha256("event:TradeEvent"))
pub const TRADE_EVENT_DISCRIMINATOR: [u8; 8] = [0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d];
```

## Common Endpoints

| Network        | Endpoint                                      |
| -------------- | --------------------------------------------- |
| Solana Mainnet | `mainnet.sol.streamingfast.io:443`            |
| Solana (Pinax) | `solana-mainnet.substreams.pinax.network:443` |

## Debugging Workflow

See `references/debug-guide.md` for detailed debugging procedures.

### Quick Debug Commands

```bash
# GUI with block range
substreams gui ./substreams.yaml map_trades \
  -e mainnet.sol.streamingfast.io:443 \
  -s 250000000 -t +100

# JSON output for parsing
substreams run ./substreams.yaml map_trades \
  -e mainnet.sol.streamingfast.io:443 \
  -s 250000000 -t +10 \
  -o json

# Debug logs in Rust
substreams::log::debug!("Processing tx: {}", signature);
```

## Golden Rules

### ❌ NEVER DO

1. Use `store` as a database
2. Scan/enumerate store (no iteration support)
3. Perform 24h aggregations in map
4. Call external APIs in map/store
5. Mix business logic (alerts, thresholds) into map
6. Treat Transfer instruction as Trade
7. Assume tx hash uniquely identifies event

### ✅ ALWAYS DO

1. Use natural keys (mint_address, signature:ix:inner_ix)
2. Separate concerns: facts → Substreams, analysis → DB
3. Track known mints only (avoid unbounded stores)
4. Test with GUI before production
5. Use params for configurable values

## Additional References

- `references/cli-commands.md` - Complete CLI reference
- `references/debug-guide.md` - Debugging procedures
- `references/manifest-reference.md` - substreams.yaml fields
- `references/solana-patterns.md` - Solana-specific patterns

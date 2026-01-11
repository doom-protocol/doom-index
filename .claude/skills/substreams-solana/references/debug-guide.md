# Substreams Debug Guide

## Debug Workflow

```
1. Build error?      → Check Cargo.toml, proto syntax
2. Empty output?     → Check module inputs, block range
3. Wrong data?       → Add debug logs, check discriminators
4. Performance?      → Check store size, module design
```

## Build Errors

### Proto Generation Failed

**Symptom:** `buf generate` or proto errors

**Checklist:**

```bash
# 1. Validate proto syntax
buf lint proto/

# 2. Check imports
cat proto/events.proto | head -20

# 3. Ensure buf is installed
buf --version

# 4. Check network (buf uses remote plugins)
curl -I https://buf.build
```

**Common fixes:**

```protobuf
// Wrong: missing package
message Trade { ... }

// Correct: with package
syntax = "proto3";
package pump.v1;

message Trade { ... }
```

### WASM Compilation Failed

**Symptom:** `cargo build --target wasm32-unknown-unknown` fails

**Checklist:**

```bash
# 1. Ensure target installed
rustup target add wasm32-unknown-unknown

# 2. Check Cargo.toml crate-type
cat Cargo.toml | grep crate-type
# Should be: crate-type = ["cdylib"]

# 3. Check for non-WASM dependencies
cargo tree | grep -E "(std|tokio|reqwest)"
```

**Common fixes:**

```toml
# Cargo.toml
[lib]
crate-type = ["cdylib"]

[dependencies]
# Use WASM-compatible crates only
substreams = "0.5"
substreams-solana = "0.14"
```

### Type Mismatch

**Symptom:** `module output type mismatch`

**Checklist:**

1. Compare `substreams.yaml` output type with proto
2. Run `substreams build` after proto changes
3. Check `src/pb/mod.rs` is up to date

```yaml
# substreams.yaml
modules:
  - name: map_trades
    output:
      type: proto:pump.v1.Trades  # Must match proto package

# proto/events.proto
syntax = "proto3";
package pump.v1;  # Must match manifest

message Trades {
  repeated Trade trades = 1;
}
```

---

## Runtime Errors

### Empty Output

**Symptom:** Module runs but produces no data

**Debug steps:**

```bash
# 1. Check if blocks contain target transactions
substreams gui ./substreams.yaml map_trades \
  -e sol.substreams.pinax.network:443 \
  -s 280000000 -t +10
# Use Tab to switch views, check Progress
```

```rust
// 2. Add debug logging
use substreams::log;

#[substreams::handlers::map]
fn map_trades(blk: Block) -> Result<Trades, Error> {
    log::info!("Block {} has {} transactions",
        blk.slot,
        blk.transactions.len()
    );

    let mut trades = Trades::default();

    for tx in blk.transactions() {
        log::debug!("TX signature: {}", bs58::encode(&tx.signature).into_string());

        for (idx, ix) in tx.instructions().enumerate() {
            log::debug!("  IX {}: program={}", idx, bs58::encode(&ix.program_id).into_string());
        }
    }

    Ok(trades)
}
```

```bash
# 3. Check block range has activity
# Use a known block with pump.fun activity
substreams run ... -s 285000000 -t +5
```

### Store Key Not Found

**Symptom:** Reading from store returns None

**Cause:** Module ordering in DAG

```yaml
# Wrong: map reads store that hasn't run
modules:
  - name: map_enrich
    inputs:
      - store: store_holders  # ❌ Runs before store

  - name: store_holders
    inputs:
      - map: map_trades

# Correct: store runs before dependent map
modules:
  - name: map_trades
    inputs:
      - source: sf.solana.type.v2.Block

  - name: store_holders
    inputs:
      - map: map_trades

  - name: map_enrich
    inputs:
      - map: map_trades
      - store: store_holders  # ✅ Runs after store
```

### Determinism Errors

**Symptom:** Different results on replay

**Checklist:**

- No external API calls
- No random/time-based logic
- Consistent iteration order
- No floating point in keys

```rust
// ❌ Non-deterministic
let now = std::time::SystemTime::now();
let random = rand::random::<u64>();

// ✅ Deterministic
let block_time = blk.block_time;
let derived_value = blk.slot * 1000;
```

---

## Debug Logging

### Log Levels

```rust
use substreams::log;

// Info: Key events (visible by default)
log::info!("Found {} trades in block {}", count, slot);

// Debug: Detailed tracing
log::debug!("Processing instruction {}: {:?}", idx, ix);

// Println also works but prefer log macros
println!("Debug: {}", value);
```

### Viewing Logs

```bash
# GUI mode shows logs in Output tab
substreams gui ...

# JSON mode includes logs
substreams run ... -o json 2>&1 | jq '.logs'

# Increase log verbosity
RUST_LOG=debug substreams run ...
```

---

## Performance Debugging

### Slow Processing

**Checklist:**

1. **Store too large?**
   - Stores with millions of keys slow down
   - Filter to only relevant mints
   - Use TTL/scope limits

2. **Too many modules?**
   - Combine extraction into single map
   - Reduce DAG depth

3. **Inefficient iteration?**

   ```rust
   // ❌ Slow: iterate all instructions
   for tx in blk.transactions() {
       for ix in tx.instructions() {
           if ix.program_id == PUMP_FUN { ... }
       }
   }

   // ✅ Fast: filter first
   for tx in blk.transactions() {
       if !tx.has_program(&PUMP_FUN_PUBKEY) { continue; }
       // Process
   }
   ```

### Memory Issues

**Symptom:** OOM or tier2 errors

```rust
// ❌ Accumulating in memory
let mut all_trades = Vec::new();
for block in blocks {
    all_trades.extend(extract_trades(block));
}

// ✅ Stream processing
fn map_trades(blk: Block) -> Result<Trades, Error> {
    // Process one block at a time
    // Let the sink handle accumulation
}
```

---

## GUI Navigation

### Screen Overview

| Screen   | Shows                   |
| -------- | ----------------------- |
| Request  | Current request params  |
| Progress | Block processing status |
| Output   | Module output data      |

### Block Navigation

```
p     → Next block
o     → Previous block
= N   → Go to block N (e.g., =280000000 Enter)
```

### Module Navigation

```
i     → Next module in DAG
u     → Previous module
```

### Search

```
/     → Start search
/buy  → Find "buy" in output
n     → Next match
```

---

## Common Debugging Patterns

### Verify Discriminator Matching

```rust
fn debug_discriminators(data: &[u8]) {
    if data.len() >= 8 {
        let disc = &data[0..8];
        log::debug!("Discriminator: {:?}", disc);
        log::debug!("As hex: {}", hex::encode(disc));
    }
}

// Compare with expected
const BUY_DISCRIMINATOR: [u8; 8] = [102, 6, 61, 18, 1, 218, 235, 234];
if &data[0..8] == BUY_DISCRIMINATOR {
    log::debug!("Matched BUY instruction");
}
```

### Trace Transaction Flow

```rust
fn debug_transaction(tx: &Transaction) {
    log::info!("=== TX {} ===", bs58::encode(&tx.signature).into_string());
    log::info!("  Success: {}", tx.meta.as_ref().map(|m| m.err.is_none()).unwrap_or(false));

    for (i, ix) in tx.instructions().enumerate() {
        log::info!("  IX[{}]: {}", i, bs58::encode(&ix.program_id).into_string());
        log::debug!("    Data len: {}", ix.data.len());
        log::debug!("    Accounts: {}", ix.accounts.len());
    }

    // Inner instructions
    if let Some(meta) = &tx.meta {
        for inner in meta.inner_instructions.iter() {
            log::info!("  Inner IX in {}: {} instructions",
                inner.index,
                inner.instructions.len()
            );
        }
    }
}
```

### Validate Store State

```rust
#[substreams::handlers::map]
fn debug_store(store: StoreGetInt64) -> Result<DebugOutput, Error> {
    // Check specific key
    if let Some(value) = store.get_last("hc:MINT_ADDRESS") {
        log::info!("Holder count for MINT: {}", value);
    } else {
        log::warn!("No holder count found for MINT");
    }

    Ok(DebugOutput::default())
}
```

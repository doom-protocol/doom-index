# Solana-Specific Patterns for Substreams

## Key Concepts

### Transaction Structure

```
Transaction
├── signature: [u8; 64]           # Unique per tx
├── message
│   ├── account_keys: Vec<Pubkey>
│   └── instructions: Vec<CompiledInstruction>
└── meta
    ├── err: Option<TransactionError>
    ├── inner_instructions: Vec<InnerInstructions>
    ├── pre_balances / post_balances
    └── pre_token_balances / post_token_balances
```

### Unique Event Identification

**Critical:** Solana transaction signature is NOT sufficient for unique event ID.

```rust
// ❌ WRONG - Multiple events can occur in same transaction
fn get_event_id(tx: &Transaction) -> String {
    bs58::encode(&tx.signature).into_string()
}

// ✅ CORRECT - Include instruction indices
fn get_event_id(
    tx: &Transaction,
    ix_index: usize,
    inner_ix_index: Option<usize>
) -> String {
    match inner_ix_index {
        Some(inner) => format!("{}:{}:{}",
            bs58::encode(&tx.signature).into_string(),
            ix_index,
            inner
        ),
        None => format!("{}:{}",
            bs58::encode(&tx.signature).into_string(),
            ix_index
        ),
    }
}
```

---

## pump.fun Specifics

### Program IDs

```rust
/// Main pump.fun program
pub const PUMP_FUN_PROGRAM: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

/// Fee recipient (used in some instructions)
pub const PUMP_FUN_FEE_RECIPIENT: &str = "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM";

/// Migration authority (when graduating to Raydium)
pub const PUMP_FUN_MIGRATION: &str = "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg";
```

### Token Characteristics

```rust
// pump.fun tokens are 6 decimals (NOT 9 like standard SPL)
pub const PUMP_FUN_DECIMALS: u8 = 6;

// Convert raw amount to human readable
fn to_human_amount(raw: u64) -> f64 {
    raw as f64 / 10f64.powi(PUMP_FUN_DECIMALS as i32)
}
```

### Instruction Discriminators

Anchor uses SHA256 of "global:{instruction_name}".

```rust
use sha2::{Sha256, Digest};

fn anchor_discriminator(instruction_name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("global:{}", instruction_name));
    let result = hasher.finalize();
    result[..8].try_into().unwrap()
}

// Pre-computed for pump.fun
pub const CREATE_DISCRIMINATOR: [u8; 8] = anchor_discriminator("create");
pub const BUY_DISCRIMINATOR: [u8; 8] = anchor_discriminator("buy");
pub const SELL_DISCRIMINATOR: [u8; 8] = anchor_discriminator("sell");
```

### Instruction Matching

```rust
fn is_pump_instruction(ix: &CompiledInstruction, program_keys: &[Pubkey]) -> bool {
    let program_id = &program_keys[ix.program_id_index as usize];
    program_id.to_string() == PUMP_FUN_PROGRAM
}

fn get_instruction_type(data: &[u8]) -> Option<&'static str> {
    if data.len() < 8 { return None; }

    let disc = &data[0..8];
    match disc {
        d if d == CREATE_DISCRIMINATOR => Some("create"),
        d if d == BUY_DISCRIMINATOR => Some("buy"),
        d if d == SELL_DISCRIMINATOR => Some("sell"),
        _ => None,
    }
}
```

---

## Holder Count Implementation

### Why Token Account State (not Transfer Instructions)

| Approach              | Pros          | Cons                               |
| --------------------- | ------------- | ---------------------------------- |
| Transfer instructions | Simple        | Noisy, incomplete, misses airdrops |
| Token Account state   | Authoritative | Slightly more complex              |

### v1 Strategy (Token Account Granularity)

```rust
#[substreams::handlers::store]
fn store_holder_count(
    blk: Block,
    store: StoreAddInt64,
) {
    for tx in blk.transactions() {
        if let Some(meta) = &tx.meta {
            // Compare pre/post token balances
            for (pre, post) in meta.pre_token_balances.iter()
                .zip(meta.post_token_balances.iter())
            {
                if pre.mint != post.mint { continue; }

                let pre_amount = parse_amount(&pre.ui_token_amount);
                let post_amount = parse_amount(&post.ui_token_amount);

                let key = format!("hc:{}", pre.mint);

                // Zero → Non-zero: new holder
                if pre_amount == 0 && post_amount > 0 {
                    store.add(1, &key, 1);
                }

                // Non-zero → Zero: holder removed
                if pre_amount > 0 && post_amount == 0 {
                    store.add(1, &key, -1);
                }
            }
        }
    }
}

fn parse_amount(ui: &UiTokenAmount) -> u64 {
    ui.amount.parse().unwrap_or(0)
}
```

---

## Event Parsing (from Logs)

### Event Structure

Anchor events are emitted via `msg!` with base64 encoding.

```rust
// Log format: "Program data: <base64_data>"
const EVENT_PREFIX: &str = "Program data: ";

fn extract_events(logs: &[String]) -> Vec<Vec<u8>> {
    logs.iter()
        .filter(|log| log.starts_with(EVENT_PREFIX))
        .filter_map(|log| {
            let b64 = &log[EVENT_PREFIX.len()..];
            base64::decode(b64).ok()
        })
        .collect()
}
```

### Event Discriminator

```rust
fn event_discriminator(event_name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("event:{}", event_name));
    let result = hasher.finalize();
    result[..8].try_into().unwrap()
}

// pump.fun events
pub const TRADE_EVENT: [u8; 8] = event_discriminator("TradeEvent");
pub const CREATE_EVENT: [u8; 8] = event_discriminator("CreateEvent");
```

---

## Block Filtering

### Using Index Modules

```yaml
# substreams.yaml
modules:
  - name: index_pump_transactions
    kind: blockIndex
    inputs:
      - source: sf.solana.type.v2.Block
    output:
      type: proto:sf.substreams.index.v1.Keys

  - name: map_trades
    kind: map
    blockFilter:
      module: index_pump_transactions
      query:
        string: "program:6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    inputs:
      - source: sf.solana.type.v2.Block
```

### CLI Filtering

```bash
# Filter by program ID
substreams run ... solana:filtered_transactions_without_votes \
  -p "program:6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"

# Combined filters
substreams run ... -p "program:6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P && account:SomeAccountAddress"
```

---

## Account Resolution

### Getting Account from Instruction

```rust
fn get_account_at_index(
    ix: &CompiledInstruction,
    account_keys: &[Pubkey],
    index: usize,
) -> Option<Pubkey> {
    ix.accounts
        .get(index)
        .and_then(|&idx| account_keys.get(idx as usize))
        .cloned()
}

// pump.fun buy instruction accounts (example)
// 0: global state
// 1: fee recipient
// 2: mint
// 3: bonding curve
// 4: associated bonding curve
// 5: associated user
// 6: user
// ...

fn extract_buy_accounts(ix: &CompiledInstruction, keys: &[Pubkey]) -> Option<BuyAccounts> {
    Some(BuyAccounts {
        mint: get_account_at_index(ix, keys, 2)?,
        bonding_curve: get_account_at_index(ix, keys, 3)?,
        user: get_account_at_index(ix, keys, 6)?,
    })
}
```

---

## Error Handling

### Transaction Success Check

```rust
fn is_successful(tx: &Transaction) -> bool {
    tx.meta
        .as_ref()
        .map(|m| m.err.is_none())
        .unwrap_or(false)
}

// Always filter failed transactions
for tx in blk.transactions() {
    if !is_successful(tx) { continue; }
    // Process...
}
```

### Common Solana Errors

| Error                      | Meaning                              |
| -------------------------- | ------------------------------------ |
| `InstructionError`         | Program execution failed             |
| `InsufficientFundsForRent` | Account would fall below rent-exempt |
| `AccountNotFound`          | Referenced account missing           |
| `ProgramFailedToComplete`  | Compute budget exceeded              |

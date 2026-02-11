#!/bin/bash
# Script to capture detailed build output

cd "$(dirname "$0")/extensions/cart-checkout-validation"

echo "=== Checking Rust installation ==="
which rustc || echo "Rust not found in PATH"
which cargo || echo "Cargo not found in PATH"

echo ""
echo "=== Checking Rust targets ==="
rustup target list --installed 2>/dev/null || echo "rustup not available"

echo ""
echo "=== Attempting cargo build with verbose output ==="
export RUST_BACKTRACE=1
cargo build --target=wasm32-unknown-unknown --release --verbose 2>&1 | tee ../../cargo-build-output.log

echo ""
echo "=== Build output saved to cargo-build-output.log ==="


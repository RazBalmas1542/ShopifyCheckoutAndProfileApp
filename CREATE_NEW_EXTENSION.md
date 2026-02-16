# How to Create a New Shopify Extension

## Method 1: Using Shopify CLI (Recommended)

Run the following command in your terminal:

```bash
shopify app generate extension
```

The CLI will prompt you to:
1. **Select the extension type** (e.g., checkout UI extension, function, theme app extension)
2. **Choose a template/flavor** (React, TypeScript, Rust, etc.)
3. **Name your extension**

### Common Extension Types:

#### Checkout UI Extension
```bash
shopify app generate extension --template=checkout_ui_extension --flavor=react
```

#### Function Extension (Rust)
```bash
shopify app generate extension --template=function --flavor=rust
```

#### Function Extension (JavaScript/TypeScript)
```bash
shopify app generate extension --template=function --flavor=typescript
```

#### Theme App Extension
```bash
shopify app generate extension --template=theme_app_extension
```

#### Admin UI Extension
```bash
shopify app generate extension --template=admin_action_extension
```

## Method 2: Manual Creation

If you prefer to create an extension manually, follow these steps:

### For a Checkout UI Extension:

1. **Create the extension directory:**
   ```bash
   mkdir -p extensions/my-new-extension/src
   mkdir -p extensions/my-new-extension/locales
   ```

2. **Create `shopify.extension.toml`:**
   ```toml
   api_version = "2026-01"

   [[extensions]]
   name = "My New Extension"
   handle = "my-new-extension"
   type = "ui_extension"
   uid = "generate-unique-id-here"

   [[extensions.targeting]]
   module = "./src/Extension.jsx"
   target = "purchase.checkout.block.render"

   [extensions.capabilities]
   network_access = true
   api_access = true
   ```

3. **Create `package.json`:**
   ```json
   {
     "name": "my-new-extension",
     "private": true,
     "version": "1.0.0",
     "dependencies": {
       "preact": "^10.10.x",
       "@preact/signals": "^2.3.x",
       "@shopify/ui-extensions": "2026.1.x"
     }
   }
   ```

4. **Create `src/Extension.jsx`:**
   ```jsx
   import {
     reactExtension,
     useApi,
   } from '@shopify/ui-extensions-react/checkout';

   export default reactExtension(
     'purchase.checkout.block.render',
     () => <Extension />
   );

   function Extension() {
     return (
       <block>
         <text>Hello from my new extension!</text>
       </block>
     );
   }
   ```

5. **Create `locales/en.default.json`:**
   ```json
   {
     "name": "My New Extension",
     "description": "Description of my extension"
   }
   ```

### For a Function Extension (Rust):

1. **Create the extension directory:**
   ```bash
   mkdir -p extensions/my-function-extension/src
   mkdir -p extensions/my-function-extension/locales
   ```

2. **Create `shopify.extension.toml`:**
   ```toml
   api_version = "2025-07"

   [[extensions]]
   name = "t:name"
   handle = "my-function-extension"
   type = "function"
   uid = "generate-unique-id-here"
   description = "t:description"

   [[extensions.targeting]]
   target = "cart.validations.generate.run"
   input_query = "src/input.graphql"
   export = "run"

   [extensions.build]
   command = "cargo build --target=wasm32-unknown-unknown --release"
   path = "target/wasm32-unknown-unknown/release/my-function-extension.wasm"
   watch = ["src/**/*.rs"]
   ```

3. **Create `Cargo.toml`:**
   ```toml
   [package]
   name = "my-function-extension"
   version = "0.1.0"
   edition = "2021"

   [lib]
   crate-type = ["cdylib"]

   [dependencies]
   shopify-function = "0.9.0"
   serde = { version = "1.0", features = ["derive"] }
   serde_json = "1.0"
   ```

4. **Create `src/lib.rs`:**
   ```rust
   use shopify_function::prelude::*;
   use shopify_function::Result;

   #[shopify_function]
   pub fn run(input: Input) -> Result<Output> {
       // Your function logic here
       Ok(Output::default())
   }
   ```

5. **Create `src/input.graphql`:**
   ```graphql
   query RunInput {
     cart {
       cost {
         totalAmount {
           amount
         }
       }
     }
   }
   ```

6. **Create `locales/en.default.json`:**
   ```json
   {
     "name": "My Function Extension",
     "description": "Description of my function extension"
   }
   ```

## After Creating Your Extension

1. **Install dependencies:**
   ```bash
   npm install
   # For Rust extensions:
   # cargo build --target=wasm32-unknown-unknown --release
   ```

2. **Test your extension:**
   ```bash
   shopify app dev
   ```

3. **Deploy your extension:**
   ```bash
   shopify app deploy
   ```

## Notes

- Each extension needs a unique `uid` in `shopify.extension.toml`
- Extensions are automatically discovered in the `extensions/` directory
- The `shopify.app.toml` file at the root manages all extensions
- Check the Shopify documentation for available targets and capabilities for each extension type



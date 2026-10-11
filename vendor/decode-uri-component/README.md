# decode-uri-component CommonJS compatibility build

Upstream 0.5.0 fixes CVE-2026-45822 but is ESM-only. Expo SDK 57's query-string 7 calls require() as a function. This copy changes only the export statement to module.exports, preserving the upstream decoder implementation and MIT license. A package override supplies it to query-string without changing the Expo SDK or routing API.

Source: npm decode-uri-component@0.5.0, https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0
Tarball integrity: sha512-1BiQVoK8C9gUbQU6NzAtO/tkz2qOFpEObMWpcFvhx4fYnj4Oc5yzaJN/LD36ihkVUdXyh5ZekzX+yM+ty/SrPg==

Remove this compatibility copy once the SDK's query parser supports the upstream ESM package. Routing compatibility/security tests are in scripts/uriDecoder.test.cjs.

## Integration and maintenance

The root package uses a local file dependency and an npm override so transitive CommonJS consumers resolve this compatibility package. Its callable CommonJS export is intentional; do not replace it with an ESM-only entry without checking those consumers.

Run `npm run test:security` from the repository root after modifying this package. [The decoder tests](../../scripts/uriDecoder.test.cjs) exercise the compatibility contract. Preserve the upstream license and review upstream changes before updating the copied implementation. This targeted compatibility fix is not proof that all dependencies are vulnerability-free.

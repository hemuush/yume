# decode-uri-component CommonJS compatibility build

Upstream 0.5.0 fixes CVE-2026-45822 but is ESM-only. Expo SDK 57's query-string 7 calls require() as a function. This copy changes only the export statement to module.exports, preserving the upstream decoder implementation and MIT license. A package override supplies it to query-string without changing the Expo SDK or routing API.

Source: npm decode-uri-component@0.5.0, https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0
Tarball integrity: sha512-1BiQVoK8C9gUbQU6NzAtO/tkz2qOFpEObMWpcFvhx4fYnj4Oc5yzaJN/LD36ihkVUdXyh5ZekzX+yM+ty/SrPg==

Remove this compatibility copy once the SDK's query parser supports the upstream ESM package. Routing compatibility/security tests are in scripts/uriDecoder.test.cjs.

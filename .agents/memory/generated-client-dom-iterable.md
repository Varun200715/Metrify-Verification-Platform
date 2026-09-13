---
name: Generated client DOM iterable support
description: The generated React API client enumerates Headers and needs DOM iterable typings in its library TypeScript config.
---

Generated client builds require `dom.iterable` alongside `dom` in the client library TypeScript `lib` list.

**Why:** Orval's fetch helper uses `Headers.entries()`, which is not included by the plain DOM typings in this workspace.

**How to apply:** If codegen succeeds but the shared client typecheck reports `Headers.entries` missing, add `dom.iterable` to the client library compiler libs before debugging the generated output.
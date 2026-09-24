# Independent M0 review evidence

The PNGs are unmodified product screenshots except 03–05, which are direct Cairo renders of the product-generated SVGs and may use fallback fonts. `annotated-evidence.html` layers review callouts over the original images. No proof scene or artwork was authored by the reviewing assistant.

The three `stripe-*.json` files contain the generated treatment records, with duplicated source packets omitted. `persistence-comparison.json` compares saved record metadata before and after app restart. `openai-provider-error.json` preserves only the CLI's public error. No private model reasoning, session signatures, credentials or complete Claude session files are included.

The backend probes were run from `apps/studio-v2/server/` in the integrated checkout. They deliberately **assert current defective behavior**. To repeat them, copy the desired test file there and run Vitest against that one file. The PostgreSQL version requires the isolated local PostgreSQL/MinIO environment variables from the review. It writes fixture notebook IDs `base-nb` and `video-nb`; do not point it at normal user data. Remove the copied test file afterward. These are reproduction fixtures, not permanent acceptance tests; invert the defect assertions as part of each repair.

Full original packets, SVGs and local runs remain in `/Users/think/Downloads/Incredible Studio/reviews/2026-09-24-independent-review/`. The application was reviewed from `.claude/worktrees/m0-integration`; the submitted M0 changes are not merged into the primary branch.

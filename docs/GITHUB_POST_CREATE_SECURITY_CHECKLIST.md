# GitHub Post-Creation Security Checklist

After repository creation, the owner or designated maintainer should verify:

- the README contains `GitHub Codespaces hosted demo currently unavailable`;
- no Codespaces launch badge or `codespaces.new` quickstart URL is published;
- no paid prebuild, paid machine, or payment method is enabled for the demo;
- the demo remains classified as `EXPERIMENTAL_LOCAL_DEMO` and is not a release gate;
- any future hosted retest requires separate owner authorization, keeps port `4173` private, and records the full create-to-demo-ready result without selecting only successful retries;

- private vulnerability reporting and a security-advisory process;
- secret scanning and push protection;
- dependency graph, Dependabot alerts, and Dependabot update PRs;
- the included CodeQL advanced setup workflow is running exactly once and uploading results; default setup is not enabled and no second CodeQL configuration exists;
- branch protection or a ruleset with required CI, CodeQL, and dependency-review checks;
- explicit owner or owner-designated maintainer approval before merge;
- force pushes and branch deletion blocked on the protected branch;
- signed commits preferred and reviewed according to project policy;
- GitHub Actions restricted to the allowlist, with full commit SHAs verified against stated release tags in the official upstream repositories;
- fork pull requests receive no repository secrets and `pull_request_target` is not used;
- least-privilege workflow tokens remain in place;
- release creation, tag protection, environments, and deploy approvals require separate owner authorization.

Record the date, actor, repository, and screenshots or exported settings in private operator evidence. Do not put access tokens or private advisory details in public issues.

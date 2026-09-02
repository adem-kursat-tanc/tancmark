# GitHub Post-Creation Security Checklist

These settings cannot be active until the owner creates the remote repository. After creation, the owner or designated maintainer should verify:

- verify that the README badge targets the exact `https://codespaces.new/adem-kursat-tanc/tancmark?quickstart=1` URL;
- under **Settings → Codespaces → Prebuild configuration**, create an every-push prebuild for `main` and `.devcontainer/devcontainer.json` in the intended regions;
- wait for the GitHub-managed prebuild workflow to pass and confirm **Prebuild ready** appears before advertising fast start;
- create one owner test Codespace from that prebuild, keep forwarded port `4173` private, and record measured create-to-demo-ready time without claiming a guaranteed value;

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

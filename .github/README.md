# DNR fork automation

This fork keeps only three GitHub Actions workflows:

- `release-dnr.yml`: build, verify, sign and publish the Arch DNR package.
- `release-dnr-macos.yml`: build, verify and publish the shared-runtime macOS package.
- `backfill-signatures.yml`: verify existing Arch release bytes and append a missing signature.

They use release tags or manual dispatch. No scheduled workflows, upstream npm
publishing, Nix releases, environment-daemon builds or issue bots are enabled.
Preserve this allowlist when merging future upstream versions.

GitHub documents automatic inactivity disabling for **scheduled** workflows in
public repositories after 60 days without repository activity. The three DNR
workflows have no `schedule` event, so they do not need artificial keepalive
commits. This does not override repository/account restrictions imposed by GitHub.

Reference: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows

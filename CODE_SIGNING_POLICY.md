# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

ClipFetch release binaries are built from this repository by GitHub Actions. Only artifacts produced from reviewed source and build scripts in this repository may be submitted for signing.

## Project roles

- Committer and reviewer: [2048-http](https://github.com/2048-http)
- Approver: [2048-http](https://github.com/2048-http)

The approver manually reviews each release signing request. Changes from outside contributors must be reviewed before they are merged.

## Release integrity

- Release builds originate from versioned source in this repository.
- GitHub Actions is the trusted build system.
- Signing requests are limited to expected ClipFetch executable and installer artifacts.
- Release metadata and version information must match the corresponding source tag.

See the [privacy policy](PRIVACY.md) for information about network communication and personal-data processing.

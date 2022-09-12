# Reasons for ignoring certain checks

## Megalinter Disabled Linters

- jscpy - CopyPaste scanning is disabled
- JAVASCRIPT_STANDARD - We use eslint instead
- REPOSITORY_TRIVY - Deufault Forta bot causes docker warnings. Trivy is unable to disable checks: <https://avd.aquasec.com/misconfig/dockerfile/general/avd-ds-0002/>

## Specific linter exemptions

- cspell - "ignoreRegExpList": "/[0-9a-f]{8}.js/gi" - scripts/download.js will save files with this name
- cspell - "ignoreRegExpList": "/[0-9a-f]{8}\\\_ABI.json/gi" - scripts/download.js will save files with this name
- cspell - "ignoreRegExpList": "/0x[0-9a-f]{40}/gi" - ignore ETH addresses
- cspell - "ignoreRegExpList": "/Qm[0-9a-zA-Z]{44}/g" - ignore IPFS CIDv0 addresses
- cspell - "ignoreRegExpList": "/bafy[0-9a-zA-Z]{40}[0-9a-zA-Z]+/g" - ignore a subset of IPFS CIDv1 addresses

- cspell - "words" - various industry words

- markdownlint - "MD041" - Ignoring first-line-h1 First line in a file should be a top-level heading

- markdown-link-check - "^<https://reqbin.com/req/>" - False positives in autotasks/nft-minter-user-signed/README.md

- proselint - typography.symbols

  - '...' is an approximation, use the ellipsis symbol '…'.
  - Use the multiplication symbol ×, not the letter x. (false positives on ETH addresses)
  - Use curly quotes “”, not straight quotes "".

- gitleaks - '(.\*?)spec\.js$' - ignore our tests, which may have mocked keys and addresses
- gitleaks - '(.\*?)defender-config\.json$' - ignore our defender-config, which may have UIDs

- secretlint --secretlintignores "**/megalinter-reports/**" - ignore output folder

- checkov - CKV_DOCKER_3 - Default forta bot triggers Docker3 error

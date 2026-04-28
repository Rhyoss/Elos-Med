# Patient PHI Encryption

## Strategy

Patient identity data is encrypted in the API before it is stored. The database
stores searchable helper fields such as `name_search`, but canonical patient
names must remain encrypted in `shared.patients.name`.

The API encryption contract is:

- algorithm: `aes-256-gcm`
- key source: `ENCRYPTION_KEY`
- stored format: `iv:authTag:ciphertext`, encoded as base64url

## Seed And Legacy Data

SQL seed files may create local fixture rows before the API process is
available. After loading seed data, run:

```sh
pnpm --filter @dermaos/api patient-phi:encrypt-legacy
```

The command is idempotent. It encrypts plaintext patient names, leaves already
decryptable rows unchanged, and warns when a value looks like ciphertext but
cannot be decrypted with the current key.

Production imports must use the API patient service or this repair command as a
controlled migration step. Do not write plaintext PHI directly to
`shared.patients.name`.

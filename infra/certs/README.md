# Certificati TLS locali (mkcert)

`api-gateway` serve HTTPS (oltre all'HTTP esistente, invariato per l'app
mobile — vedi CLAUDE.md) perché il cookie httpOnly del login web richiede
`Secure` (necessario per poterlo mandare cross-origin con `SameSite=None`,
dato che webapp e gateway sono origini diverse anche in locale). I file
`.pem` qui dentro non sono versionati (vedi `.gitignore`): vanno generati
una volta per macchina di sviluppo con [mkcert](https://github.com/FiloSottile/mkcert).

```bash
# Installazione (una tantum per macchina)
winget install --id FiloSottile.mkcert -e   # Windows
mkcert -install                              # crea e fida una CA locale

# Generazione del certificato (dalla cartella infra/certs)
mkcert -key-file localhost-key.pem -cert-file localhost-cert.pem localhost 127.0.0.1 ::1
```

`mkcert -install` fida la CA locale nel trust store di sistema/browser di
**questa** macchina: un certificato generato così non è valido su un'altra
macchina (es. il telefono di test mobile) senza rifare `-install` anche
lì — per questo l'app mobile continua a usare l'HTTP esistente del gateway,
non toccato da questo cambiamento (vedi commento in
`services/api-gateway/src/index.ts`).

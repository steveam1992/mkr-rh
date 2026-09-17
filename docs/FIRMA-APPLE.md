# Firmar y notarizar para macOS (opcional)

Sin esto la app funciona, pero macOS avisa la primera vez que se abre
(ver `INSTALACION-MACOS.md`). Con esto, se abre sin ningun aviso.

Requiere una suscripcion a **Apple Developer Program** (99 USD/ano).

## 1. Obtener el certificado

1. En https://developer.apple.com/account/resources/certificates crea un
   certificado de tipo **Developer ID Application**.
2. Instalalo en el Llavero de un Mac.
3. Exportalo como `.p12` con contrasena (Llavero → clic derecho → Exportar).
4. Conviertelo a base64:

   ```bash
   base64 -i certificado.p12 | pbcopy
   ```

## 2. Crear una contrasena especifica de app

En https://account.apple.com → Iniciar sesion y seguridad → Contrasenas
especificas para apps. Sirve para que el notarizador se autentique.

## 3. Secrets del repositorio

En GitHub → Settings → Secrets and variables → Actions:

| Secret | Valor |
| --- | --- |
| `MAC_CSC_LINK` | el `.p12` en base64 |
| `MAC_CSC_KEY_PASSWORD` | la contrasena del `.p12` |
| `APPLE_ID` | el correo de la cuenta de desarrollador |
| `APPLE_APP_SPECIFIC_PASSWORD` | la contrasena del paso 2 |
| `APPLE_TEAM_ID` | el Team ID (10 caracteres) |

## 4. Cambios en el proyecto

En `package.json`, dentro de `build.mac`:

```json
"hardenedRuntime": true,
"gatekeeperAssess": false,
"notarize": true
```

En `.github/workflows/build.yml`, sustituye el bloque `env:` del paso
`pnpm run package` por:

```yaml
        env:
          CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

El hook `build/adhoc-sign.js` se desactiva solo en cuanto detecta `CSC_LINK`,
asi que no hay que tocarlo.

# Instalacion en macOS

Las compilaciones de GitHub Actions estan **firmadas ad-hoc pero no notarizadas**
(no hay cuenta de Apple Developer de por medio). Eso significa que la app arranca,
pero Gatekeeper avisa la primera vez porque no puede verificar al desarrollador.

## Pasos

1. En la pagina del workflow en GitHub, descarga el artefacto `mkr-rh-mac`.
2. GitHub entrega los artefactos dentro de un `.zip`. Descomprimelo y usa el
   archivo **`.dmg`** que hay dentro (el `.zip` interno tambien sirve, pero el
   `.dmg` es mas fiable).
3. Elige el `.dmg` que corresponde a tu Mac:
   - `arm64` para Macs con chip Apple (M1, M2, M3, M4...)
   - `x64` para Macs con procesador Intel
4. Abre el `.dmg` y arrastra **MKR RH** a `Aplicaciones`.
5. Quita la marca de cuarentena que macOS pone a todo lo descargado de internet:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/MKR RH.app"
   ```

6. Abre la app normalmente.

## Si aun asi no abre

Si macOS muestra *"no se puede abrir porque Apple no puede comprobar si contiene
software malicioso"*, ve a **Ajustes del Sistema → Privacidad y seguridad**,
baja hasta el aviso sobre MKR RH y pulsa **Abrir de todos modos**.

Si el mensaje es *"La aplicacion ... esta danada y no se puede abrir"*, casi
siempre es que el `.app` se extrajo con una herramienta que rompe los enlaces
simbolicos del framework de Electron. Vuelve a instalar desde el `.dmg`.

Como ultimo recurso, se puede volver a firmar en local:

```bash
xattr -cr "/Applications/MKR RH.app"
codesign --force --deep --sign - "/Applications/MKR RH.app"
```

## Como eliminar el aviso definitivamente

Hace falta una cuenta de **Apple Developer Program** (99 USD/ano) para firmar con
un certificado *Developer ID Application* y notarizar el build. Con eso, macOS abre
la app sin ningun aviso. Ver `docs/FIRMA-APPLE.md`.

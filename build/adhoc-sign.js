'use strict'

// Firma ad-hoc del bundle .app cuando no hay certificado de Apple disponible.
//
// electron-builder se salta la firma por completo si no encuentra una identidad
// (es lo que hace CSC_IDENTITY_AUTO_DISCOVERY=false en CI). El problema es que un
// binario arm64 SIN NINGUNA firma no puede ejecutarse en Apple Silicon: el kernel
// lo rechaza y el Finder muestra "La aplicacion ... no se puede abrir".
//
// Una firma ad-hoc ("-") no necesita cuenta de desarrollador y deja la app
// ejecutable. Sigue sin estar notarizada, asi que Gatekeeper pedira confirmacion
// la primera vez: ver docs/INSTALACION-MACOS.md.

const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin' || process.platform !== 'darwin') {
    return
  }

  // Si hay un certificado real configurado, deja que electron-builder firme.
  if (process.env.CSC_LINK || process.env.CSC_NAME) {
    return
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  // Los atributos extendidos que deja el runner invalidan la firma.
  execFileSync('xattr', ['-cr', appPath], { stdio: 'inherit' })
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' })

  console.log(`  • firma ad-hoc aplicada  file=${appPath}`)
}

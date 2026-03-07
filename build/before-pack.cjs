/**
 * Hook do electron-builder: roda antes de empacotar.
 * Gera env.install a partir do .env para o instalador já incluir .env configurado.
 */
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function (context) {
  const appDir = context.appDir || process.cwd()
  const scriptPath = path.join(appDir, 'scripts', 'generate-env-install.cjs')
  execSync(`node "${scriptPath}"`, { stdio: 'inherit', cwd: appDir })
}

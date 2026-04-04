#!/usr/bin/env node
/**
 * No GitHub Actions (push na main): grava em package.json uma versão semver única
 * por run, para o electron-updater no Windows enxergar atualização a cada build.
 * Formato: major.minor.(100000 + GITHUB_RUN_NUMBER) — preserva major.minor do repo.
 * Não rodar localmente para release manual; tags v*.*.* usam sync de versão no workflow.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const run = parseInt(process.env.GITHUB_RUN_NUMBER || '0', 10)
if (!run) {
  console.error('ci-set-build-version: defina GITHUB_RUN_NUMBER (apenas no CI).')
  process.exit(1)
}

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const parts = String(pkg.version || '').split('.')
const major = parseInt(parts[0], 10)
const minor = parseInt(parts[1], 10)
if (!Number.isFinite(major) || !Number.isFinite(minor)) {
  console.error('ci-set-build-version: versão inválida em package.json:', pkg.version)
  process.exit(1)
}

const patch = 100000 + run
pkg.version = `${major}.${minor}.${patch}`
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('Versão CI (auto-update):', pkg.version)

import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const config = JSON.parse(await readFile(resolve('src-tauri/tauri.conf.json'), 'utf8'))
const source = resolve('src-tauri/target/release/worth-remembering.exe')
const targetDir = resolve('release')
let target = resolve(targetDir, `${config.productName}_v${config.version}.exe`)
await mkdir(targetDir, { recursive: true })
try {
  await copyFile(source, target)
} catch (error) {
  if (error.code !== 'EBUSY') throw error
  target = resolve(targetDir, `${config.productName}_v${config.version}_绿色版.exe`)
  await copyFile(source, target)
}
console.log(`绿色版已生成：${target}`)

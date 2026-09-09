import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const stateFile = path.join(process.cwd(), '.browser-control-state.json')

function saveState(url) {
  const state = {
    pid: process.pid,
    url,
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
}

function removeState() {
  if (fs.existsSync(stateFile)) {
    fs.rmSync(stateFile, { force: true })
  }
}

async function openPage(url) {
  const targetUrl = url || 'http://127.0.0.1:5173'
  const browser = await chromium.launch({
    headless: false,
  })

  const page = await browser.newPage()
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })

  saveState(targetUrl)

  console.log(`Opened browser page: ${targetUrl}`)
  console.log(`Session PID: ${process.pid}`)
  console.log('Press Ctrl+C in the terminal to close the browser session.')

  await new Promise((resolve) => {
    process.once('SIGINT', resolve)
    process.once('SIGTERM', resolve)
  })

  await browser.close()
  removeState()
  console.log('Browser session closed.')
}

async function closePage() {
  if (!fs.existsSync(stateFile)) {
    console.log('No active browser session found.')
    return
  }

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  const pid = Number(state.pid)

  if (Number.isFinite(pid)) {
    try {
      process.kill(pid)
      console.log(`Requested shutdown for browser session PID ${pid}.`)
    } catch {
      console.log(`Unable to terminate PID ${pid}, it may already be gone.`)
    }
  }

  removeState()
}

const [, , command, arg] = process.argv

if (command === 'open') {
  await openPage(arg)
} else if (command === 'close') {
  await closePage()
} else {
  console.log('Usage:')
  console.log('  node scripts/browser-control.mjs open <url>')
  console.log('  node scripts/browser-control.mjs close')
}

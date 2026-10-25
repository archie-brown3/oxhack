#!/usr/bin/env node
// Update one task on the shared board without an AI provider.
// Usage: node scripts/board.mjs <id> [--status <s>] [--note "<text>"]
// The note is appended to the task's details with a UTC stamp.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const file = fileURLToPath(new URL('../.taskmaster/tasks/tasks.json', import.meta.url))
const [id, ...rest] = process.argv.slice(2)
const opt = {}
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1]
if (!id || rest.length % 2) { console.error('usage: board.mjs <id> [--status s] [--note text]'); process.exit(2) }

const board = JSON.parse(readFileSync(file, 'utf8'))
const task = board.master.tasks.find((t) => String(t.id) === id)
if (!task) { console.error(`no task ${id}`); process.exit(1) }
const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
if (opt.status) task.status = opt.status
if (opt.note) task.details = `${task.details ?? ''}\n${now}: ${opt.note}`.trim()
task.updatedAt = now
board.master.metadata.lastModified = now
board.master.metadata.completedCount = board.master.tasks.filter((t) => t.status === 'done').length
// Escape non-ASCII like the Python writer that made the file, so diffs stay small.
const text = JSON.stringify(board, null, 2).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
writeFileSync(file, text + '\n')
console.log(`task ${id}: ${task.status}`)

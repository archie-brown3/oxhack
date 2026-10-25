// Keeps one failing part (the WebGL globe, the Engine) from blanking the whole app: when Chrome refuses a
// WebGL context (too many tabs) three.js throws on mount, and without a boundary React unmounts everything.
import { Component, type ReactNode } from 'react'

export class Boundary extends Component<{ fallback?: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.warn('Part of the page failed to load and was skipped:', error) }
  render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children }
}

import { Call } from '@wailsio/runtime'
import api, { type ApiResponse } from '@/api'
import { isDesktopRuntime } from './desktopManager'

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  available: boolean
  supported: boolean
  reason: string
  releaseURL: string
  releaseNotes: string
}

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'restarting' | 'error'
  progress: number
  downloadedBytes: number
  totalBytes: number
  message: string
}

interface ReleaseInfo {
  html_url: string
  tag_name: string
  body?: string
}

const serviceName = 'github.com/primordialweave/zhusuan/internal/desktop.AppUpdater'
const versionPattern =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/

const parseVersion = (version: string) => {
  const match = versionPattern.exec(version.trim())
  if (!match) throw new Error('版本信息无效，请稍后重试')
  const prerelease = match[4]?.split('.') ?? []
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) {
    throw new Error('版本信息无效，请稍后重试')
  }
  return { core: match.slice(1, 4).map(BigInt), prerelease }
}

/** Compares SemVer precedence; build metadata never makes a release newer. */
export const isNewerVersion = (latest: string, current: string) => {
  const first = parseVersion(latest)
  const second = parseVersion(current)
  for (let index = 0; index < first.core.length; index += 1) {
    if (first.core[index] !== second.core[index]) return first.core[index]! > second.core[index]!
  }
  if (first.prerelease.length === 0 || second.prerelease.length === 0) {
    return first.prerelease.length === 0 && second.prerelease.length > 0
  }
  for (
    let index = 0;
    index < Math.max(first.prerelease.length, second.prerelease.length);
    index += 1
  ) {
    const left = first.prerelease[index]
    const right = second.prerelease[index]
    if (left === right) continue
    if (left === undefined || right === undefined) return right === undefined
    const leftNumeric = /^\d+$/.test(left)
    const rightNumeric = /^\d+$/.test(right)
    if (leftNumeric !== rightNumeric) return !leftNumeric
    return leftNumeric ? BigInt(left) > BigInt(right) : left > right
  }
  return false
}

export const appUpdater = {
  isAvailable: isDesktopRuntime,

  async checkForUpdates(currentVersion: string): Promise<UpdateInfo> {
    if (this.isAvailable()) {
      const info: UpdateInfo = await Call.ByName(`${serviceName}.CheckForUpdates`)
      return {
        ...info,
        available: info.available && isNewerVersion(info.latestVersion, info.currentVersion),
      }
    }
    const { data } = await api.get<ApiResponse<ReleaseInfo>>('/system/updates/check')
    const release = data.data
    return {
      currentVersion,
      latestVersion: release.tag_name,
      available: isNewerVersion(release.tag_name, currentVersion),
      supported: false,
      reason: '浏览器预览请从发布页下载安装。',
      releaseURL: release.html_url,
      releaseNotes: release.body ?? '',
    }
  },

  startUpdate: (): Promise<void> => Call.ByName(`${serviceName}.StartUpdate`),
  status: (): Promise<UpdateStatus> => Call.ByName(`${serviceName}.Status`),
  cancelUpdate: (): Promise<void> => Call.ByName(`${serviceName}.CancelUpdate`),
}

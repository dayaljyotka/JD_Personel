import { waitFor } from './../../apis/node'
import {
  SettingConfig as settingCfg,
  enableServiceFeature,
} from './../../services'
import { verifyApiKey } from './../../apis/openai'

export class ManagedApiKey {
  private static instance: ManagedApiKey
  private _isQueued = false

  public static getInstance(): ManagedApiKey {
    if (!ManagedApiKey.instance) {
      ManagedApiKey.instance = new ManagedApiKey()
    }
    return ManagedApiKey.instance
  }

  public async verify(): Promise<void> {
    if (this._isQueued === true) return

    this._isQueued = true
    await waitFor(500, () => false)
    await verifyApiKey()
    enableServiceFeature()
    settingCfg.log()
    this._isQueued = false
  }
}

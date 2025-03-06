import { WebviewView } from 'vscode'
import { ConversationStorageService } from './../../../services'

export const onDidInitialize = (_webView: WebviewView): void => {
  ConversationStorageService.instance.refresh()
}

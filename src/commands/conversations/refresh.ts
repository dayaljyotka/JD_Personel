import { ICommand } from './../../commands'
import { ConversationStorageService } from './../../services'

export default class RefreshConversationsCommand implements ICommand {
  public readonly id = '_vscode-openai.conversations.refresh'

  public async execute() {
    ConversationStorageService.instance.refresh()
  }
}

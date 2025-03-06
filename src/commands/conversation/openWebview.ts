import { ICommand } from './../../commands'
import { IConversation } from './../../interfaces'
import { ConversationStorageService } from './../../services'

export default class OpenConversationWebviewCommand implements ICommand {
  public readonly id = '_vscode-openai.conversation.open.webview'

  public execute(args: { data: IConversation }) {
    ConversationStorageService.instance.show(args.data.conversationId)
  }
}

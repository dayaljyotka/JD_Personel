import { window } from 'vscode'
import { ICommand } from './../../commands'
import { IConversation } from './../../interfaces'
import { ConversationStorageService } from './../../services'

export default class DeleteConversationCommand implements ICommand {
  public readonly id = '_vscode-openai.conversation.delete'

  public execute(args: { data: IConversation }) {
    window
      .showInformationMessage(
        'Are you sure you want to delete this conversation?',
        'Yes',
        'No'
      )
      .then((answer) => {
        if (answer === 'Yes') {
          ConversationStorageService.instance.delete(args.data.conversationId)
        }
      })
  }
}

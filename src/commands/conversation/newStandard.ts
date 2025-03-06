import { ICommand } from '@app/commands'
import { IConversation } from '@app/interfaces'
import { getSystemPersonas } from './../../models'
import { ConversationStorageService } from './../../services'
import { VSCODE_OPENAI_QP_PERSONA } from './../../constants'

export default class NewConversationStandardCommand implements ICommand {
  public readonly id = 'vscode-openai.conversation.new.standard'

  public async execute() {
    const persona = getSystemPersonas().find(
      (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.GENERAL
    )!
    const conversation: IConversation =
      await ConversationStorageService.instance.create(persona)
    ConversationStorageService.instance.update(conversation)
    ConversationStorageService.instance.show(conversation.conversationId)
  }
}

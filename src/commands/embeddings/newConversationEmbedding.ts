import { ICommand } from './../../commands'
import { IConversation } from './../../interfaces'
import { ConversationStorageService } from './../../services'
import { EmbeddingTreeItem } from './../../providers'
import { getQueryResourcePersona } from './../../models'

export default class NewConversationEmbeddingCommand implements ICommand {
  public readonly id = 'vscode-openai.embeddings.new.conversation'

  public async execute(node: EmbeddingTreeItem) {
    const persona = getQueryResourcePersona()
    const conversation: IConversation =
      await ConversationStorageService.instance.create(
        persona,
        node.embeddingId
      )
    ConversationStorageService.instance.update(conversation)
    ConversationStorageService.instance.show(conversation.conversationId)
  }
}

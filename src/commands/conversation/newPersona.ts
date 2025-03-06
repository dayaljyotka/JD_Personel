import { ExtensionContext } from 'vscode'
import { ICommand } from '@app/commands'
import { quickPickCreateConversation } from './../../utilities/quickPicks'

export default class NewConversationPersonaCommand implements ICommand {
  public readonly id = 'vscode-openai.conversation.new.persona'
  public constructor(private _context: ExtensionContext) {}

  public async execute() {
    quickPickCreateConversation(this._context)
  }
}

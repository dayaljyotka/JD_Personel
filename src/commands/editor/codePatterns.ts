import { ICommand } from './../../commands'
import { getSystemPersonas } from './../../models'
import {
  compareResultsToClipboard,
  getEditorPrompt,
} from './../../utilities/editor'
import { VSCODE_OPENAI_QP_PERSONA } from './../../constants'

export default class CodePatternsCommand implements ICommand {
  public readonly id = '_vscode-openai.editor.code.pattern'

  public async execute() {
    const prompt = await getEditorPrompt('editor.code.pattern')
    const persona = getSystemPersonas().find(
      (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.DEVELOPER
    )
    compareResultsToClipboard(persona, prompt)
  }
}

import { ICommand } from './../../commands'
import { getSystemPersonas } from './../../models'
import {
  compareResultsToClipboard,
  getEditorPrompt,
} from './../../utilities/editor'
import { VSCODE_OPENAI_QP_PERSONA } from './../../constants'

export default class CodeOptimizeCommand implements ICommand {
  public readonly id = '_vscode-openai.editor.code.optimize'

  public async execute() {
    console.warn('Optimizing file')
    const prompt = await getEditorPrompt('editor.code.optimize')
    const persona = getSystemPersonas().find(
      (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.DEVELOPER
    )

    compareResultsToClipboard(persona, prompt)
  }
}

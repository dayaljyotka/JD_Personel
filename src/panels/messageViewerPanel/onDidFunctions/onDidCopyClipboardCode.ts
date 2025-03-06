import { env } from 'vscode'
import { showMessageWithTimeout } from './../../../apis/vscode'
import { ICodeDocument } from './../../../interfaces'

export const onDidCopyClipboardCode = (codeDocument: ICodeDocument): void => {
  env.clipboard.writeText(codeDocument.content)
  showMessageWithTimeout(
    `Successfully copied ${codeDocument.language} code to clipboard`,
    2000
  )
}

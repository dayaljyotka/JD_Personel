import { EmbeddingTreeDataProvider } from './../../providers'
import { ICommand } from './../../commands'

export default class RefreshCommand implements ICommand {
  public readonly id = '_vscode-openai.embeddings.refresh'
  public constructor(private _instance: EmbeddingTreeDataProvider) {}

  public async execute() {
    this._instance.refresh()
  }
}

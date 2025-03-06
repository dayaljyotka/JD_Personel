import * as vscode from 'vscode';
import { ICommand } from './../../commands/ICommand';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getSystemPersonas } from './../../models/index';
import { VSCODE_OPENAI_QP_PERSONA } from './../../constants';
import { compareResultsToClipboard } from './../../utilities/editor';

export default class FolderOptimizationCommand implements ICommand {
  public readonly id = '_vscode-openai.editor.code.optimizeFolder';

  public async execute(): Promise<void> {
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select Folder to Optimize',
    });

    if (folderUri && folderUri[0]) {
      const folderPath = folderUri[0].fsPath;
      await this.processFolder(folderPath);
    }
  }

  private async processFolder(folderPath: string): Promise<void> {
    try {
      const files = await fs.readdir(folderPath);
      const filesToOptimize = files.filter(
        (file) => file.endsWith('.java')
      );

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Optimizing Folder',
          cancellable: false,
        },
        async (progress) => {
          const persona = getSystemPersonas().find(
            (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.DEVELOPER
          );
          if (!persona) {
            vscode.window.showErrorMessage("Developer persona not found.");
            return;
          }

          const optimizationPromises = filesToOptimize.map(async (file, index) => {
            const filePath = path.join(folderPath, file);
            const document = await vscode.workspace.openTextDocument(filePath);
            const prompt = document.getText(); // get the entire content of the file.
            await vscode.window.showTextDocument(document);

            await compareResultsToClipboard(persona, prompt); // Pass the document URI

            progress.report({
              increment: (index + 1) * (100 / filesToOptimize.length),
              message: `Optimized ${file}`,
            });
          });

          await Promise.all(optimizationPromises);
        }
      );

      vscode.window.showInformationMessage('Folder optimization complete.');
    } catch (error) {
      vscode.window.showErrorMessage(`Error optimizing folder: ${error}`);
    }
  }
}

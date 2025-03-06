import { ICommand } from './../../commands'
import * as vscode from 'vscode';
import * as path from 'path';
import { getSystemPersonas } from './../../models/index';
import { VSCODE_OPENAI_QP_PERSONA } from './../../constants';
import { compareResultsToClipboard } from './../../utilities/editor';

async function getWorkspaceFilesIgnoringGitignore(): Promise<vscode.Uri[]> {
  if (!vscode.workspace.workspaceFolders) {
      return [];
  }

  const workspaceFolder = vscode.workspace.workspaceFolders[0];
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  console.log('gitExtension', gitExtension);
  if (!gitExtension) {
      // Git extension not found.
      vscode.window.showErrorMessage('Git extension not found.');
      return [];
  }

  if (!gitExtension.isActive) {
      await gitExtension.activate();
  }

  const git = gitExtension.exports.getAPI(1); // Get the Git API

  const repo = git.getRepository(workspaceFolder.uri);
  console.log('repo', repo);
  if (!repo) {
      // Git repository not found.
      return await vscode.workspace.findFiles('**/*');
  }

  try {
      const stagedChanges = await repo?.getStagedChanges();
      const unstagedChanges = await repo?.getUnstagedChanges();

      const trackedFiles = new Set<string>();

      [...stagedChanges, ...unstagedChanges].forEach((change) => {
          trackedFiles.add(change.uri.fsPath);
      });

      const fileUris = Array.from(trackedFiles).map((fsPath) => vscode.Uri.file(fsPath));
      console.log();
      return fileUris;
  } catch (error) {
      console.error('Error getting Git tracked files:', error);
      return [];
  }
}


export default class ReadWorkspaceCommand implements ICommand {
  public readonly id = '_vscode-openai.editor.code.readWorkspace'

  public async execute(): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder opened.');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    console.log('workspaceFolder', workspaceFolder)
    //const srcFolder = path.join(workspaceFolder.uri.fsPath, 'src');

    try {
      const fileUris = await getWorkspaceFilesIgnoringGitignore();

      if (fileUris.length === 0) {
        vscode.window.showInformationMessage('No files found in the workspace.');
        return;
      }
      // Continue with your file selection and optimization logic using fileUris.
      const fileItems = fileUris.map((file: any) => ({
        label: path.basename(file.fsPath),
        description: vscode.workspace.asRelativePath(file.fsPath),
        uri: file,
      }));
      console.log('fileItems', fileItems)
      const selectedFiles = await vscode.window.showQuickPick(fileItems, {
        canPickMany: true,
        title: 'Select .java files to optimize from src folder',
      });

      if (selectedFiles && selectedFiles.length) {
        await this.optimizeSelectedFiles(selectedFiles.map((item) => item.uri));
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error finding files: ${error}`);
    }
  }

  private async optimizeSelectedFiles(fileUris: vscode.Uri[]): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Optimizing Selected Files',
        cancellable: false,
      },
      async (progress) => {
        const persona = getSystemPersonas().find(
          (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.DEVELOPER
        );
        if (!persona) {
          vscode.window.showErrorMessage('Developer persona not found.');
          return;
        }

        const optimizationPromises = fileUris.map(async (fileUri, index) => {
          const document = await vscode.workspace.openTextDocument(fileUri);
          const prompt = document.getText();
          await vscode.window.showTextDocument(document);

          await compareResultsToClipboard(persona, prompt);

          progress.report({
            increment: (index + 1) * (100 / fileUris.length),
            message: `Optimized ${path.basename(fileUri.fsPath)}`,
          });
        });

        await Promise.all(optimizationPromises);
      }
    );

    vscode.window.showInformationMessage('Selected files optimized.');
  }
}

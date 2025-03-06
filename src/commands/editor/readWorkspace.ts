import { ICommand } from './../../commands';
import * as vscode from 'vscode';
import OpenAI from 'openai';

// Module-level variables
let openai: OpenAI | undefined;

async function getWorkspaceFilesIgnoringGitignore(): Promise<vscode.Uri[]> {
  // ... (Your existing getWorkspaceFilesIgnoringGitignore function)
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

    const fileUris = Array.from(trackedFiles).map((fsPath) =>
      vscode.Uri.file(fsPath)
    );
    console.log();
    return fileUris;
  } catch (error) {
    console.error('Error getting Git tracked files:', error);
    return [];
  }
}

export default class ReadWorkspaceCommand implements ICommand {
  private context: vscode.ExtensionContext;
  public readonly id = '_vscode-openai.editor.code.readWorkspace';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public async execute(): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder opened.');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    console.log('workspaceFolder', workspaceFolder);

    try {
      const fileUris = await getWorkspaceFilesIgnoringGitignore();

      if (fileUris.length === 0) {
        vscode.window.showInformationMessage('No files found in the workspace.');
        return;
      }

      // Store the file list in the ExtensionContext
      await this.context.workspaceState.update('workspaceFiles', fileUris);

      // Print what's stored in context
      const storedFiles = this.context.workspaceState.get<vscode.Uri[]>('workspaceFiles');
      console.log('Stored workspaceFiles in context:', storedFiles);


      // Initialize OpenAI client
      if (!openai) {
        const apiKey = vscode.workspace
          .getConfiguration('vscode-openai')
          .get<string>('apiKey');

        if (!apiKey) {
          vscode.window.showErrorMessage(
            'OpenAI API key not found in settings.'
          );
          return;
        }
        openai = new OpenAI({ apiKey: apiKey });
      }

      vscode.window.showInformationMessage('Workspace files loaded.');
    } catch (error) {
      vscode.window.showErrorMessage(`Error finding files: ${error}`);
    }
  }
}

// New command for processing files
// export class ProcessWorkspaceFilesCommand implements ICommand {
//   public readonly id = '_vscode-openai.editor.code.processWorkspaceFiles';

//   public async execute(): Promise<void> {
//     if (!workspaceFiles || !openai) {
//       vscode.window.showErrorMessage(
//         'Workspace files or OpenAI session not initialized.'
//       );
//       return;
//     }

//     await vscode.window.withProgress(
//       {
//         location: vscode.ProgressLocation.Notification,
//         title: 'Processing Workspace Files',
//         cancellable: false,
//       },
//       async (progress) => {
//         const persona = getSystemPersonas().find(
//           (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.DEVELOPER
//         );
//         if (!persona) {
//           vscode.window.showErrorMessage('Developer persona not found.');
//           return;
//         }

//         const processingPromises = workspaceFiles.map(async (fileUri, index) => {
//           const document = await vscode.workspace.openTextDocument(fileUri);
//           const prompt = document.getText();
//           await vscode.window.showTextDocument(document);

//           await compareResultsToClipboard(persona, prompt);

//           progress.report({
//             increment: (index + 1) * (100 / workspaceFiles.length),
//             message: `Processed ${path.basename(fileUri.fsPath)}`,
//           });
//         });

//         await Promise.all(processingPromises);
//       }
//     );

//     vscode.window.showInformationMessage('Workspace files processed.');
//   }
// }

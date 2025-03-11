import { ICommand } from './../../commands';
import * as vscode from 'vscode';
import OpenAI from 'openai';
import { spawn } from 'child_process';
import * as path from 'path';

let openai: OpenAI | undefined;

// Helper function to check which files are ignored by Git using batch processing
async function getNonIgnoredFiles(): Promise<vscode.Uri[]> {
  try {
    // Step 1: Get all files in the workspace
    const allFiles: vscode.Uri[] = await vscode.workspace.findFiles('**/*'); // Retrieve all files in the workspace
    console.log("All files in workspace:", allFiles.length);

    // Step 2: Get the root folder of the workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("No workspace folder found.");
      return [];
    }
    const workspaceFolder = workspaceFolders[0]; // Assume first workspace folder
    const workspaceUri = workspaceFolder.uri; // Workspace root URI

    // Step 3: Use git to check for ignored files
    const ignoredFiles = await getGitIgnoredFiles(
      workspaceUri,
      allFiles.map((file) => file.fsPath)
    );

    // Step 4: Filter out ignored files and return non-ignored files
    const nonIgnoredFiles = allFiles.filter(
      (file) => !ignoredFiles.has(path.relative(workspaceUri.fsPath, file.fsPath))
    );

    console.log("Non-ignored files:", nonIgnoredFiles.length);
    return nonIgnoredFiles; // Return the non-ignored files
  } catch (error) {
    console.error(`Error fetching non-ignored files: ${error}`);
    vscode.window.showErrorMessage(`Error fetching non-ignored files: ${error}`);
    return [];
  }
}

function getGitIgnoredFiles(workspaceUri: vscode.Uri, filePaths: string[]): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const relativePaths = filePaths.map((filePath) =>
      path.relative(workspaceUri.fsPath, filePath)
    );

    console.log("Relative paths sent to Git:", relativePaths);

    const gitProcess = spawn('git', ['-C', workspaceUri.fsPath, 'check-ignore', '--stdin']);

    let stdout = '';
    let stderr = '';

    gitProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    gitProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    gitProcess.on('close', (code) => {
      if (code === 0 || code === 1) {
        // Parse ignored files from stdout
        const ignoredFiles = new Set(
          stdout.split('\n').map((line) => line.trim()).filter((line) => line)
        );
        resolve(ignoredFiles);
      } else {
        reject(new Error(`Git error: ${stderr || 'Unknown error'}`));
      }
    });

    gitProcess.on('error', (error) => {
      reject(error);
    });

    // Write file paths to the Git process
    relativePaths.forEach((relativePath) => {
      if (relativePath) {
        gitProcess.stdin.write(`${relativePath}\n`);
      }
    });

    gitProcess.stdin.end();
  });
}

// VS Code command implementation
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
    console.log('Workspace Folder:', workspaceFolder);

    try {
      const fileUris = await getNonIgnoredFiles();

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
          vscode.window.showErrorMessage('OpenAI API key not found in settings.');
          return;
        }
        openai = new OpenAI({ apiKey });
      }

      vscode.window.showInformationMessage('Workspace files loaded.');
    } catch (error) {
      vscode.window.showErrorMessage(`Error finding files: ${error}`);
    }
  }
}
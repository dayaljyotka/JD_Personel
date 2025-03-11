import { ICommand } from './../../commands';
import * as vscode from 'vscode';
import OpenAI from 'openai';
import { spawn } from 'child_process';
import * as path from 'path';

let openai: OpenAI | undefined;

// Function to fetch Git ignored files
function getGitIgnoredFiles(workspaceUri: vscode.Uri, filePaths: string[]): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const relativePaths = filePaths.map((filePath) =>
      path.relative(workspaceUri.fsPath, filePath)
    );

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
      gitProcess.stdin.write(`${relativePath}\n`);
    });

    gitProcess.stdin.end();
  });
}

// Function to get non-ignored files (returns an array directly)
async function getNonIgnoredFiles(workspaceUri: vscode.Uri): Promise<vscode.Uri[]> {
  try {
    // Step 1: Get all files in the workspace
    const allFiles: vscode.Uri[] = await vscode.workspace.findFiles('**/*'); // Retrieve all files in the workspace
    console.log("TotalFiles:",allFiles.length);

    // Step 2: Fetch the ignored files (including ignored folders and files)
    const ignoredFiles = await getGitIgnoredFiles(
      workspaceUri,
      allFiles.map((file) => file.fsPath)
    );

    const normalizedIgnoredFiles = new Set(Array.from(ignoredFiles).map((filePath) =>
      filePath.replace(/\\\\/g, '\\').replace(/"/g, ""))
    );

    normalizedIgnoredFiles.forEach(
      x=>{console.log("ignored Files:",x) }
    );

    // Step 3: Filter out the non-ignored files
    const nonIgnoredFiles: vscode.Uri[] = [];

    // Iterate over all files
    for (const file of allFiles) {
      const relativeFilePath:string = path.relative(workspaceUri.fsPath, file.fsPath).trim().toLowerCase();
      console.log("relativePaths:",relativeFilePath);
      //let isIgnored = normalizedIgnoredFiles.has(`${relativeFilePath}`); // Check if the exact file is ignored
      let isIgnored = [...normalizedIgnoredFiles].some(filePath => filePath.toLowerCase() === relativeFilePath.toLowerCase());

      // If not ignored, add it to the list of non-ignored files
      if (!isIgnored) {
        nonIgnoredFiles.push(file);
      }
    }

    // Step 4: Return the array of non-ignored files
    console.log("nonIgnoredFiles:",nonIgnoredFiles.length);
    return nonIgnoredFiles;

  } catch (error) {
    console.error(`Error fetching non-ignored files: ${error}`);
    vscode.window.showErrorMessage(`Error fetching non-ignored files: ${error}`);
    return []; // Return an empty array in case of error
  }
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

    try {
      const fileUris = await getNonIgnoredFiles(vscode.Uri.file(workspaceFolder.uri.fsPath));

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
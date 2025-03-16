import { ICommand } from './../../commands';
import * as vscode from 'vscode';
import { ConversationStorageService } from './../../services/index';
import {
  IChatCompletion,
  IConversation,
} from './../../interfaces';
import {
  ChatCompletionConfig,
  ChatCompletionModelType,
} from './../../services/configuration';
import * as path from 'path';
import * as fs from 'fs';
import { getSystemPersonas } from './../../models';
import { VSCODE_OPENAI_QP_PERSONA } from './../../constants';
import { createChatCompletionMessage } from './../../apis/openai';

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
      // Step 1: Get all files in the workspace
      const allFiles: vscode.Uri[] = await vscode.workspace.findFiles('**/*');
      console.log('Total files in workspace:', allFiles.length);

      // Step 2: Read .gitignore content (if it exists)
      const gitignorePath = path.join(workspaceFolder.uri.fsPath, '.gitignore');
      let gitignoreContent = '';
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      }

      // Step 3: Split files into batches
      const filePaths = allFiles.map((file) =>
        path.relative(workspaceFolder.uri.fsPath, file.fsPath)
      );

      const batchSize = 20; // Define batch size
      const batches = [];
      for (let i = 0; i < filePaths.length; i += batchSize) {
        batches.push(filePaths.slice(i, i + batchSize));
      }

      const persona = getSystemPersonas().find(
        (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.DEVELOPER
      );

      if (!persona) {
        throw new Error('Persona not found.');
      }

      let filteredFilePaths: string[] = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        const prompt = `
I want to filter out the list of non-ignored files from the list of all files in a workspace. The content of the '.gitignore' file is provided below. Please return only the files that are not ignored by the patterns in the '.gitignore' file. All the files and folders mentioned in the gitignore content provided should be ignored, and only the path of non-ignored files should be returned.

List of files:
${batch.join('\n')}

.gitignore contents:
${gitignoreContent || 'No .gitignore file found'}

Return the non-ignored file paths as a JSON array of strings.
        `;

        const conversation: IConversation =
          await ConversationStorageService.instance.create(persona);

        const chatCompletion: IChatCompletion = {
          content: prompt,
          author: 'vscode-openai-editor',
          timestamp: new Date().toLocaleString(),
          mine: false,
          completionTokens: 0,
          promptTokens: 0,
          totalTokens: 0,
        };

        const cfg = ChatCompletionConfig.create(ChatCompletionModelType.INFERENCE);

        conversation.chatMessages.length = 0; // Clear previous messages
        conversation.chatMessages.push(chatCompletion);

        function messageCallback(_type: string, data: IChatCompletion): void {
          if (!conversation) return;
          console.log(`Raw response for batch ${batchIndex + 1}:`, data.content);

          try {
            const batchResults = JSON.parse(data.content.trim());
            filteredFilePaths.push(...batchResults);
          } catch (error) {
            console.error(`Error parsing OpenAI response for batch ${batchIndex + 1}:`, error);
            vscode.window.showErrorMessage(`Failed to parse OpenAI response for batch ${batchIndex + 1}.`);
          }
        }

        await createChatCompletionMessage(conversation, cfg, messageCallback);
      }

      console.log('Filtered non-ignored File Length:', filteredFilePaths.length);

      if (filteredFilePaths.length === 0) {
        vscode.window.showInformationMessage('No non-ignored files found.');
        return;
      }

      // Step 4: Convert filtered paths to `vscode.Uri` and store in context
      const nonIgnoredFiles = filteredFilePaths.map((relativePath) =>
        vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, relativePath))
      );

      await this.context.workspaceState.update('workspaceFiles', nonIgnoredFiles);

      vscode.window.showInformationMessage('Workspace files loaded and stored in context.');
    } catch (error) {
      vscode.window.showErrorMessage(`Error executing command: ${error}`);
      console.error(error);
    }
  }
}

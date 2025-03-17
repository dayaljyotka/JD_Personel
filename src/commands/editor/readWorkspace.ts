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
import ignore from 'ignore'; // Install ignore package

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
      // Step 1: Get all files and directories in the workspace
      const allFiles: vscode.Uri[] = await vscode.workspace.findFiles('**/*');
      console.log('Total files in workspace:', allFiles.length);

      // Step 2: Read .gitignore content (if it exists)
      const gitignorePath = path.join(workspaceFolder.uri.fsPath, '.gitignore');
      let gitignoreContent = '';
      const ig = ignore();
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        ig.add(gitignoreContent);
      }

      // Step 3: Build a directory tree and filter based on .gitignore
      const filePaths = allFiles.map((file) =>
        path.relative(workspaceFolder.uri.fsPath, file.fsPath)
      );

      const filteredPaths = filePaths.filter((filePath) => !ig.ignores(filePath));
      console.log('Non-ignored paths after filtering:', filteredPaths);

      const persona = getSystemPersonas().find(
        (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.DEVELOPER
      );

      if (!persona) {
        throw new Error('Persona not found.');
      }

      // Step 4: Process the filtered files in batches
      const batchSize = 20;
      const batches = [];
      for (let i = 0; i < filteredPaths.length; i += batchSize) {
        batches.push(filteredPaths.slice(i, i + batchSize));
      }

      let finalFilteredFilePaths: string[] = [];

      const processBatch = async (batch: string[], batchIndex: number): Promise<void> => {
        const prompt = `
Here is a batch of files and the content of the '.gitignore' file. Please filter out any ignored files based on the '.gitignore' content. Return only the non-ignored file paths as a JSON array of strings.

.gitignore contents:
${gitignoreContent || 'No .gitignore file found'}

Batch of files:
${batch.join('\n')}

In the response, only return the non-ignored file paths as a JSON array of strings. In cas ethe array is blank if the batch being processed has no non-ignored files, then only retrun a blank array in response, no other message.
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

        return new Promise<void>((resolve, reject) => {
          function messageCallback(_type: string, data: IChatCompletion): void {
            try {
              const batchResults = JSON.parse(data.content.trim());
              finalFilteredFilePaths.push(...batchResults);
              resolve();
            } catch (error) {
              console.error(`Error parsing OpenAI response for batch ${batchIndex + 1}:`, error);
              reject(new Error(`Failed to parse OpenAI response for batch ${batchIndex + 1}.`));
            }
          }

          createChatCompletionMessage(conversation, cfg, messageCallback)
            .catch((err) => reject(err));
        });
      };

      const batchPromises = batches.map((batch, index) => processBatch(batch, index));
      await Promise.all(batchPromises);

      console.log('Filtered non-ignored File Length:', finalFilteredFilePaths.length);

      if (finalFilteredFilePaths.length === 0) {
        vscode.window.showInformationMessage('No non-ignored files found.');
        return;
      }

      // Step 5: Convert filtered paths to `vscode.Uri` and store in context
      const nonIgnoredFiles = finalFilteredFilePaths.map((relativePath) =>
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

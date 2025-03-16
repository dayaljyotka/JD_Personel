import { ICommand } from './../../commands';
import * as vscode from 'vscode';
import { ConversationStorageService } from './../../services/index';
import {
  IChatCompletion,
  IConversation,
} from '@app/interfaces';
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

      // Step 3: Prepare the prompt for OpenAI
      const filePaths = allFiles.map((file) =>
        path.relative(workspaceFolder.uri.fsPath, file.fsPath)
      );

      const prompt = `

I want to filter out the list of non ignored files from the  list of all files in a workspace  and the content of the '.gitignore' file provided below. Please return only the files that are not ignored by the patterns in the '.gitignore' file. All the files and folders mentioned in the gitignore content provided should be ignored and only the path of non ignored files should be returned.

List of files:
${filePaths.join('\n')}

.gitignore contents:
${gitignoreContent || 'No .gitignore file found'}

Return the non-ignored file paths as a JSON array of strings.
`;
      
      const persona = getSystemPersonas().find(
        (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.DEVELOPER
      )

      if (!persona) {
        throw new Error('Persona not found.');
      }

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

      let filteredFilePaths: string[] = [];

      function messageCallback(_type: string, data: IChatCompletion): void {
        if (!conversation) return;
        console.log("Raw response content:", data.content); 
        
        try {
          filteredFilePaths = JSON.parse(data.content.trim());
        } catch (error) {
          console.error('Error parsing OpenAI response:', error);
          vscode.window.showErrorMessage('Failed to parse OpenAI response.');
        }
      }

      await createChatCompletionMessage(conversation, cfg, messageCallback);

      console.log("Filetered non ignored File Length is :", filteredFilePaths.length);

      if (filteredFilePaths.length === 0) {
        vscode.window.showInformationMessage('No non-ignored files found.');
        return;
      }

      // Step 5: Convert filtered paths to `vscode.Uri` and store in context
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

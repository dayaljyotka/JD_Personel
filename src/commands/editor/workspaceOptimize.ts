import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ICommand } from './../../commands/ICommand';
import { getSystemPersonas } from './../../models'
import { compareResultsToClipboard } from './../../utilities/editor';
import { VSCODE_OPENAI_QP_PERSONA } from './../../constants'

export default class WorkspaceOptimizationCommand implements ICommand {
  public readonly id = '_vscode-openai.editor.code.optimizeWorkspace';
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
}

  public async execute() {
    console.log('Optimizing workspace');
    const fileUris = this.context.workspaceState.get<vscode.Uri[]>('workspaceFiles');
        if (!fileUris || fileUris.length === 0) {
            vscode.window.showErrorMessage('No workspace files loaded. Run "Read Workspace" first.');
            return;
        }

        console.log('Files in storage', fileUris.length)

        const batchSize = 5;
        const delayBetweenBatches = 5000;

        for (let i = 0; i < fileUris.length; i += batchSize) {
          const batch = fileUris.slice(i, i + batchSize);
          const promises = batch.map(async (uri) => {
            try {
              const fileContent = fs.readFileSync(uri.fsPath, 'utf-8');
              const language = this.getLanguageFromUri(uri);
              const prompt = this.createPrompt(language, fileContent);

              const persona = getSystemPersonas().find(
                (a) => a.roleName === VSCODE_OPENAI_QP_PERSONA.DEVELOPER
              );
              const optimizedContent = await this.getOptimizedContent(persona, prompt);

              if (optimizedContent) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(optimizedContent, 'utf-8'));
                console.log(`Optimized: ${uri.fsPath}`);
              } else {
                console.error(`Failed to optimize: ${uri.fsPath}`);
              }
            } catch (error) {
              console.error(`Error processing ${uri.fsPath}:`, error);
            }
          });

          await Promise.all(promises);
          if (i + batchSize < fileUris.length) {
            await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
          }
        }

        vscode.window.showInformationMessage('Workspace optimization complete.');
    }

    private async getOptimizedContent(persona: any, prompt: string): Promise<string | undefined> {
        try {
            await compareResultsToClipboard(persona, prompt);
            const optimizedCode = await vscode.env.clipboard.readText();
            if(optimizedCode.length > 0){
                return optimizedCode;
            } else {
                return undefined;
            }

        } catch (error) {
            console.error('Error getting optimized content:', error);
            return undefined;
        }
    }

    private getLanguageFromUri(uri: vscode.Uri): string {
      const extension = path.extname(uri.fsPath).slice(1);

      switch (extension) {
          case 'ts':
              return 'typescript';
          case 'js':
              return 'javascript';
          case 'tsx':
              return 'typescriptreact';
          case 'jsx':
              return 'javascriptreact';
          case 'java':
              return 'java';
          case 'py':
              return 'python';
          case 'cpp':
              return 'cpp';
          case 'c':
              return 'c';
          case 'html':
              return 'html';
          case 'css':
              return 'css';
          case 'json':
              return 'json';
          case 'xml':
              return 'xml';
          case 'sh':
              return 'shellscript';
          default:
              return extension; // or a default language
      }
  }

    private createPrompt(language: string, sourceCode: string): string {
      return `I am working with a program written in ${language} and need assistance in optimizing its performance. Please analyze the provided source code and suggest optimizations to reduce the number of operations during execution. The optimizations should maintain the original functionality of the code.\n\nThe response should be in plain text format, suitable for direct use as a source file. It must strictly adhere to the syntax and conventions of ${language} and only include valid ${language} source code. The optimized code should be complete and ready for compilation or execution in a suitable environment.\n\nHere is the source code that needs optimization:\n\`\`\`${language}\n${sourceCode}\n\`\`\``;
    }
}

import { env, window } from 'vscode';
import { ConversationStorageService } from './../../services/index';
import { IChatCompletion, IConversation, IPersonaOpenAI } from '@app/interfaces';
import { createChatCompletionMessage } from './../../apis/openai';
import {
  ChatCompletionConfig,
  ChatCompletionModelType,
} from './../../services/configuration';

// Function to process files in batches
async function processFilesInBatches(
  persona: IPersonaOpenAI,
  files: string[],
  batchSize: number
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize); // Get the current batch
    const prompt = `The following are file paths in the workspace. Please identify which ones are ignored by .gitignore:\n${batch.join(
      '\n'
    )}`;

    try {
      const batchResult = await sendPromptToOpenAI(persona, prompt);
      results.push(...batchResult.split('\n').map((line) => line.trim()));
    } catch (error) {
      window.showErrorMessage(`Error processing batch ${i / batchSize + 1}: ${error}`);
      console.error(error);
    }
  }

  return results;
}

// Function to send prompt to OpenAI
async function sendPromptToOpenAI(
  persona: IPersonaOpenAI,
  prompt: string
): Promise<string> {
  const conversation: IConversation = await ConversationStorageService.instance.create(persona);

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

  conversation.chatMessages.length = 0; // Clear the conversation
  conversation.chatMessages.push(chatCompletion);

  return new Promise((resolve, reject) => {
    let result = '';
    function messageCallback(_type: string, data: IChatCompletion): void {
      if (data.content) {
        result = data.content;
      }
    }

    createChatCompletionMessage(conversation, cfg, messageCallback)
      .then(() => resolve(result))
      .catch((error) => reject(error));
  });
}

// Main command to execute
export const compareResultsToClipboard = async (
  persona: IPersonaOpenAI | undefined,
  files: string[] | undefined
): Promise<void> => {
  if (!persona || !files || files.length === 0) {
    window.showErrorMessage('Persona or file list is undefined or empty.');
    return;
  }

  const batchSize = 20; // Number of files to process in each batch

  try {
    const results = await processFilesInBatches(persona, files, batchSize);

    // Save results to clipboard
    const originalValue = await env.clipboard.readText();
    await env.clipboard.writeText(results.join('\n'));
    window.showInformationMessage(`Results saved to clipboard. Processed ${results.length} files.`);
    await env.clipboard.writeText(originalValue);
  } catch (error) {
    window.showErrorMessage(`An error occurred while processing files: ${error}`);
    console.error(error);
  }
};

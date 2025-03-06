import { ExtensionContext, commands } from 'vscode'

import { CommandManager, registerVscodeOpenAICommands } from './commands'
import { StatusBarServiceProvider, TelemetryService } from './apis/vscode'

import { registerVscodeOpenAIServices } from './services'
import {
  createDebugNotification,
  createErrorNotification,
  createInfoNotification,
} from './apis/node'
import {
  EmbeddingTreeDataProvider,
  conversationsWebviewViewProvider,
} from './providers'
import { disableServiceFeature } from './services/featureFlagServices'
import ReadWorkspaceCommand from './commands/editor/readWorkspace'

export function activate(context: ExtensionContext) {
  try {
    disableServiceFeature()

    // Enable logging and telemetry
    TelemetryService.init(context)
    createInfoNotification('activate vscode-openai')

    createDebugNotification('initialise components')
    StatusBarServiceProvider.init(context)
    StatusBarServiceProvider.instance.showStatusBarInformation()

    registerVscodeOpenAIServices(context)

    // registerCommands
    createDebugNotification('initialise vscode commands')
    const commandManager = new CommandManager()
    const embeddingTree = new EmbeddingTreeDataProvider(context)
    context.subscriptions.push(
      registerVscodeOpenAICommands(context, commandManager, embeddingTree)
    )
    conversationsWebviewViewProvider(context)

     // Register new commands
     context.subscriptions.push(
      commands.registerCommand('_vscode-openai.editor.code.readWorkspace', () => {
        new ReadWorkspaceCommand(context).execute();
      })
    );

    createInfoNotification('vscode-openai ready')
  } catch (error: unknown) {
    createErrorNotification(error)
  }
}

export interface WidgetBridgePlugin {
  writeSnapshot(options: { json: string }): Promise<void>;
}

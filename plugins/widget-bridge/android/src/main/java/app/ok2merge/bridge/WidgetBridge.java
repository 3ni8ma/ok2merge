package app.ok2merge.bridge;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {
  @PluginMethod
  public void writeSnapshot(PluginCall call) {
    String json = call.getString("json", "{}");
    getContext()
      .getSharedPreferences("ok2merge_widget", 0)
      .edit()
      .putString("snapshot", json)
      .apply();
    call.resolve();
  }
}

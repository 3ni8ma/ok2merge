package app.ok2merge.bridge

import com.getcapacitor.CapacitorPlugin
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridge : Plugin() {
  @PluginMethod
  fun writeSnapshot(call: PluginCall) {
    context
      .getSharedPreferences("ok2merge_widget", 0)
      .edit()
      .putString("snapshot", call.getString("json") ?: "{}")
      .apply()
    call.resolve()
  }
}

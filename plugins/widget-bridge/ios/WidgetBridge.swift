import Foundation
import Capacitor

@objc(WidgetBridge)
public class WidgetBridge: CAPPlugin {
  let store = UserDefaults(suiteName: "group.app.ok2merge.dev")!

  @objc func writeSnapshot(_ call: CAPPluginCall) {
    store.set(call.getString("json") ?? "{}", forKey: "snapshot")
    call.resolve()
  }
}

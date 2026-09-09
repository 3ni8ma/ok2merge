import SwiftUI
import WidgetKit

struct Snapshot: Decodable {
  var count = 0
  var oldestAgeMin = 0
  var ciFails = 0
  var updatedAt = 0
}

struct Entry: TimelineEntry {
  let date = Date()
  let snap: Snapshot
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { Entry(snap: Snapshot()) }

  func getSnapshot(
    in context: Context, completion: @escaping (Entry) -> Void
  ) {
    completion(Entry(snap: load()))
  }

  func getTimeline(
    in context: Context, completion: @escaping (Timeline<Entry>) -> Void
  ) {
    completion(
      Timeline(
        entries: [Entry(snap: load())],
        policy: .after(Date().addingTimeInterval(15 * 60))))
  }

  func load() -> Snapshot {
    guard
      let s = UserDefaults(suiteName: "group.app.ok2merge.dev")?
        .string(forKey: "snapshot"),
      let d = s.data(using: .utf8),
      let snap = try? JSONDecoder().decode(Snapshot.self, from: d)
    else { return Snapshot() }
    return snap
  }
}

struct WidgetView: View {
  var e: Entry

  var age: String {
    let s = Int(Date().timeIntervalSince1970) - e.snap.updatedAt / 1000
    if s < 60 { return "\(s)s ago" }
    return "\(s / 60)m ago"
  }

  var body: some View {
    VStack(alignment: .leading) {
      Text("\(e.snap.count) to review")
        .font(.headline).foregroundColor(.white)
      Text("oldest \(e.snap.oldestAgeMin)m")
        .font(.caption).foregroundColor(.gray)
      if e.snap.ciFails > 0 {
        Text("CI failing: \(e.snap.ciFails)")
          .font(.caption).foregroundColor(.red)
      }
      Spacer()
      Text("updated \(age)").font(.caption2).foregroundColor(.gray)
    }.padding()
      .background(Color(red: 0.05, green: 0.07, blue: 0.09))
      .widgetURL(URL(string: "ok2merge://"))  // root route IS the inbox
  }
}

@main struct OK2MergeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ok2merge", provider: Provider()) { e in
      WidgetView(e: e)
    }
    .configurationDisplayName("OK2Merge")
    .description("PRs waiting on you.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

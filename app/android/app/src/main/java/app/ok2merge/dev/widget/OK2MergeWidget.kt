package app.ok2merge.dev.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import app.ok2merge.dev.R
import org.json.JSONObject

class OK2MergeWidget : AppWidgetProvider() {
  override fun onUpdate(
    c: Context,
    mgr: AppWidgetManager,
    ids: IntArray
  ) {
    val raw =
      c.getSharedPreferences("ok2merge_widget", 0).getString("snapshot", "{}")
    val j = JSONObject(raw ?: "{}")
    val mins = ((System.currentTimeMillis() - j.optLong("updatedAt")) / 60000).toInt()
    val v = RemoteViews(c.packageName, R.layout.widget_layout).apply {
      setTextViewText(R.id.count, "${j.optInt("count")} to review")
      setTextViewText(
        R.id.sub,
        "oldest ${j.optInt("oldestAgeMin")}m · updated ${mins}m ago"
      )
      setOnClickPendingIntent(
        R.id.root,
        PendingIntent.getActivity(
          c,
          0,
          Intent(Intent.ACTION_VIEW, Uri.parse("ok2merge://")),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
      )
    }
    ids.forEach { mgr.updateAppWidget(it, v) }
  }
}

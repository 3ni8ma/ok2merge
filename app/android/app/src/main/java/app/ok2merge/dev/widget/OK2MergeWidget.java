package app.ok2merge.dev.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import app.ok2merge.dev.R;
import org.json.JSONObject;

public class OK2MergeWidget extends AppWidgetProvider {
  @Override
  public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
    SharedPreferences prefs = c.getSharedPreferences("ok2merge_widget", 0);
    JSONObject j;
    try {
      j = new JSONObject(prefs.getString("snapshot", "{}"));
    } catch (Exception e) {
      j = new JSONObject();
    }
    long updatedAt = j.optLong("updatedAt");
    int count = j.optInt("count");
    String sub;
    if (count == 0) {
      sub = "Inbox zero";
    } else if (updatedAt == 0) {
      sub = "no data yet";
    } else {
      int mins = (int) ((System.currentTimeMillis() - updatedAt) / 60000);
      sub = "oldest " + j.optInt("oldestAgeMin") + "m · updated " + mins + "m ago";
    }
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_layout);
    v.setTextViewText(R.id.count, count + " to review");
    v.setTextViewText(R.id.sub, sub);
    PendingIntent tap = PendingIntent.getActivity(
      c,
      0,
      new Intent(Intent.ACTION_VIEW, Uri.parse("ok2merge://")),
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    v.setOnClickPendingIntent(R.id.root, tap);
    for (int id : ids) {
      mgr.updateAppWidget(id, v);
    }
  }
}

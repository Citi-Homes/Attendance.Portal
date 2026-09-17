package ae.citihomes.attendance;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import java.util.Calendar;

public class AttendanceReminder extends BroadcastReceiver {
    static final String CHANNEL = "attendance_reminders_v2";

    static long nextTime(int hour, long now) {
        Calendar next = Calendar.getInstance();
        next.setTimeInMillis(now);
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, 55);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= now) next.add(Calendar.DATE, 1);
        while (next.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) next.add(Calendar.DATE, 1);
        return next.getTimeInMillis();
    }

    static void schedule(Context context) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL,
                "Attendance reminders", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Punch in at 09:55 and punch out at 17:55, phone local time.");
            channel.enableVibration(true);
            nm.createNotificationChannel(channel);
        }
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        for (int hour : new int[]{9, 17}) {
            Intent intent = new Intent(context, AttendanceReminder.class)
                .setAction("ae.citihomes.attendance.REMINDER").putExtra("hour", hour);
            PendingIntent pending = PendingIntent.getBroadcast(context, hour, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            long time = nextTime(hour, System.currentTimeMillis());
            try {
                if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) {
                    alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pending);
                } else {
                    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pending);
                }
            } catch (SecurityException ex) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pending);
            }
        }
    }

    @Override public void onReceive(Context context, Intent intent) {
        schedule(context);
        if (!"ae.citihomes.attendance.REMINDER".equals(intent.getAction())) return;
        if (Calendar.getInstance().get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) return;
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        int hour = intent.getIntExtra("hour", 9);
        PendingIntent open = PendingIntent.getActivity(context, hour,
            new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        builder.setSmallIcon(R.drawable.ic_stat_attendance)
            .setContentTitle(hour == 9 ? "Punch in reminder" : "Punch out reminder")
            .setContentText(hour == 9 ? "It is 09:55. Please record your attendance."
                : "It is 17:55. Please punch out before leaving.")
            .setCategory(Notification.CATEGORY_REMINDER)
            .setPriority(Notification.PRIORITY_HIGH)
            .setDefaults(Notification.DEFAULT_ALL)
            .setContentIntent(open).setAutoCancel(true);
        context.getSystemService(NotificationManager.class).notify(hour, builder.build());
    }
}
